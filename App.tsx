import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  GoogleSignin,
  statusCodes,
  SignInResponse,
} from '@react-native-google-signin/google-signin'; // Import SignInResponse type
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const App = () => {
  const webViewRef = useRef<WebView>(null);

  // Make sure this IP is correct and includes the query parameter
  // const WEB_URL = 'http://192.168.139.167:5173/?isReactNativeApp=true';
  // const WEB_URL = 'http://192.168.35.228:5173/?isReactNativeApp=true';
  const WEB_URL = 'https://baff-fe.vercel.app/?isReactNativeApp=true';
  // const BACKEND_URL = 'http://10.0.2.2:8080'; // Assuming backend runs on 8080
  const BACKEND_URL = 'https://baff-be-ckop.onrender.com'; // Assuming backend runs on 8080

  // Google Web Client ID from AuthController.java
  const GOOGLE_WEB_CLIENT_ID =
    '1068438948743-r2a9hcnpuc8uphj75e0msmqv6qqhgrel.apps.googleusercontent.com';
  // const GOOGLE_WEB_CLIENT_ID = '1068438948743-8uh3m6ssd8nc290hi8kja624015drh4v.apps.googleusercontent.com';
  // const GOOGLE_WEB_CLIENT_ID = '1068438948743-a9hcnpuc8uphj75e0msmqv6qqhgrel.apps.googleusercontent.com';

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true, // if you need to access Google API on behalf of the user from your backend
    });
  }, []);

  const _signIn = async () => {
    try {
      console.log('RN: 로그인 시도');
      await GoogleSignin.hasPlayServices();
      const userInfo: SignInResponse = await GoogleSignin.signIn();
      console.log('RN: 로그인 성공', userInfo);

      const idToken = userInfo.data?.idToken;
      if (!idToken) {
        throw new Error('Google Id Token을 얻을 수 없습니다.');
      }

      console.log('RN: 백엔드에 IdToken 전송중...');

      try {
        const backendResponse = await axios.post(
          `${BACKEND_URL}/api/auth/google/mobile`,
          {
            idToken: idToken,
          },
          {
            timeout: 10000, // 10초 타임아웃
          },
        );

        const { token: accessToken, user: backendUser } = backendResponse.data;
        console.log('RN: 백엔드 응답 성공');
        console.log('- Access Token:', accessToken ? 'received' : 'missing');
        console.log('- User Data:', backendUser);

        await AsyncStorage.setItem('userToken', accessToken);
        console.log('RN: 토큰 저장 완료');

        // 🔥 수정: injectJavaScript를 사용하여 메시지 전송
        const messageData = {
          type: 'GOOGLE_LOGIN_SUCCESS',
          user: {
            // id: userInfo.data?.user.id,
            id: backendUser.userId,
            email: userInfo.data?.user.email,
            name: userInfo.data?.user.name,
            picture: userInfo.data?.user.photo,
            provider: 'google',
          },
          accessToken: accessToken,
          redirectTo: 'https://baff-fe.vercel.app',
        };

        const jsCode = `
        console.log('RN: 웹으로 메시지 전송 중:', ${JSON.stringify(
          messageData,
        )});
        document.cookie = 'accessToken=${accessToken}; path=/; max-age=604800;';
        
        // 방법 1: window.postMessage 사용
        window.postMessage(${JSON.stringify(messageData)}, '*');
        
        // 방법 2: 커스텀 이벤트 디스패치
        window.dispatchEvent(new CustomEvent('googleLoginSuccess', {
          detail: ${JSON.stringify(messageData)}
        }));
        
        // 방법 3: 전역 변수 설정
        window.googleLoginData = ${JSON.stringify(messageData)};
        
        true; // injectJavaScript는 반드시 true를 반환해야 함
      `;

        webViewRef.current?.injectJavaScript(jsCode);
        console.log('RN: 웹뷰에 메시지 전송 완료');
      } catch (backendError: any) {
        console.error('RN: 백엔드 API 호출 실패:', backendError);

        const errorMessage =
          backendError.response?.data?.message ||
          backendError.message ||
          '백엔드 로그인 처리 중 오류가 발생했습니다.';

        const errorData = {
          type: 'GOOGLE_LOGIN_ERROR',
          message: errorMessage,
          details: {
            status: backendError.response?.status,
            data: backendError.response?.data,
          },
        };

        const errorJsCode = `
          console.log('RN→웹: 에러 메시지 전송', ${JSON.stringify(errorData)});
          window.postMessage(${JSON.stringify(errorData)}, '*');
          window.dispatchEvent(new CustomEvent('googleLoginError', {
            detail: ${JSON.stringify(errorData)}
          }));
          true;
        `;

        webViewRef.current?.injectJavaScript(errorJsCode);
        Alert.alert('로그인 오류', `백엔드 처리 실패: ${errorMessage}`);
      }
    } catch (error: any) {
      console.log('RN: 구글 로그인 실패', error);

      // 🔥 수정: 구글 로그인 자체 실패 처리
      let errorMessage = '구글 로그인에 실패했습니다.';

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        errorMessage = '사용자가 로그인을 취소했습니다.';
      } else if (error.code === statusCodes.IN_PROGRESS) {
        errorMessage = '이미 로그인 작업이 진행 중입니다.';
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        errorMessage = 'Google Play 서비스가 없거나 오래되었습니다.';
      }

      const errorData = {
        type: 'GOOGLE_LOGIN_ERROR',
        message: errorMessage,
      };

      const errorJsCode = `
        console.log('RN→웹: 에러 메시지 전송', ${JSON.stringify(errorData)});
        window.postMessage(${JSON.stringify(errorData)}, '*');
        window.dispatchEvent(new CustomEvent('googleLoginError', {
          detail: ${JSON.stringify(errorData)}
        }));
        true;
      `;

      webViewRef.current?.injectJavaScript(errorJsCode);
      Alert.alert('로그인 실패', errorMessage);
    }
  };

  // const _signOut = async () => {
  //   try {
  //     await GoogleSignin.revokeAccess();
  //     await GoogleSignin.signOut();
  //     await AsyncStorage.removeItem('userToken');
  //     Alert.alert('로그아웃 성공', '성공적으로 로그아웃되었습니다.');
  //     // Optionally, send a message to the webview to clear its state
  //     webViewRef.current?.postMessage(
  //       JSON.stringify({ type: 'LOGOUT_SUCCESS' }),
  //     );
  //   } catch (error: any) {
  //     console.error('Google Sign-Out Error:', error);
  //     Alert.alert(
  //       '로그아웃 오류',
  //       `로그아웃 중 오류가 발생했습니다: ${error.message}`,
  //     );
  //   }
  // };

  // "퐁" 받기
  const handleWebMessage = useCallback((event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('[App] 웹으로부터 메시지 받음:', message);

      switch (message.type) {
        case 'REQUEST_GOOGLE_LOGIN':
          console.log('REQUEST_GOOGLE_LOGIN');
          _signIn();
          break;
        default:
          console.log('[App] <UNK> <UNK> <UNK> <UNK>');
      }
    } catch (error) {
      console.log(error);
    }
  }, []);

  return (
    <View style={styles.container}>
      {/*<View style={styles.buttonContainer}>*/}
      {/*  <Button title="Google 로그인" onPress={_signIn} />*/}
      {/*  <Button title="로그아웃" onPress={_signOut} />*/}
      {/*</View>*/}

      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webView}
        onMessage={handleWebMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        // @ts-ignore
        onConsoleMessage={event => {
          console.log('[WebView Console]', event.nativeEvent.message);
        }}
        onLoadError={(syntheticEvent: any) => {
          // 다시 any 타입으로 변경
          const { nativeEvent } = syntheticEvent;
          console.error(
            '[WebView Load Error]',
            nativeEvent.code,
            nativeEvent.description,
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  buttonContainer: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  webView: {
    flex: 1,
  },
});

export default App;
