import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Alert, Button, Platform } from 'react-native';
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
  const WEB_URL = 'http://192.168.139.167:5173/?isReactNativeApp=true';
  // const WEB_URL = 'https://baff-fe.vercel.app/?isReactNativeApp=true';
  const BACKEND_URL = 'http://10.0.2.2:8080'; // Assuming backend runs on 8080

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
      console.log("RN: 로그인 시도");
      await GoogleSignin.hasPlayServices();
      const userInfo: SignInResponse = await GoogleSignin.signIn();
      console.log("RN: 로그인 성공", userInfo);



      // 🔥 수정: injectJavaScript를 사용하여 메시지 전송
      // const messageData = {
      //   type: 'GOOGLE_LOGIN_SUCCESS',
      //   user: {
      //     id: userInfo.data!.id,
      //     email: userInfo.data!.email,
      //     name: userInfo.data!.name,
      //     picture: userInfo.data!.photo,
      //     provider: 'google'
      //   },
      //   redirectTo: '/dashboard'
      // };

      const messageData = {
        sibal: 'sse Ki'
      }

      const jsCode = `
        console.log('RN: 웹으로 메시지 전송 중:', ${JSON.stringify(messageData)});
        
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

    } catch (error) {
      console.log("RN: 로그인 실패", error);

      const errorData = {
        type: 'GOOGLE_LOGIN_ERROR',
        message: '구글 로그인에 실패했습니다.'
      };

      const errorJsCode = `
        console.log('RN: 에러 메시지 전송 중:', ${JSON.stringify(errorData)});
        window.postMessage(${JSON.stringify(errorData)}, '*');
        window.dispatchEvent(new CustomEvent('googleLoginError', {
          detail: ${JSON.stringify(errorData)}
        }));
        true;
      `;

      webViewRef.current?.injectJavaScript(errorJsCode);
    }
  }


  // const _signIn = async () => {
  //   try {
  //     console.log('signIn');
  //     await GoogleSignin.hasPlayServices();
  //     const userInfo: SignInResponse = await GoogleSignin.signIn(); // Correctly type userInfo as SignInResponse
  //     console.log('Google User Info:', userInfo);
  //
  //     let idToken = userInfo.data?.idToken;
  //
  //     if (idToken) {
  //       // Send idToken to your backend
  //       console.log('Sending idToken to backend:', idToken);
  //       try {
  //         const response = await axios.post(
  //           `${BACKEND_URL}/api/auth/google/mobile`,
  //           {
  //             idToken: idToken,
  //           },
  //         );
  //
  //         const { token, user } = response.data;
  //         console.log('Backend JWT:', token);
  //         console.log('Backend User Data:', user);
  //
  //         // Store JWT securely
  //         await AsyncStorage.setItem('userToken', token);
  //         Alert.alert('로그인 성공', '백엔드로부터 JWT를 받았습니다!');
  //
  //         // Send JWT and user data to webview
  //         // webViewRef.current?.postMessage(JSON.stringify({ type: 'LOGIN_SUCCESS', token: token, user: user }));
  //         if (webViewRef.current) {
  //           webViewRef.current.injectJavaScript(`
  //     if (window.ReactNativeWebView) {
  //           window.ReactNativeWebView.postMessage(JSON.stringify({
  //             type: "LOGIN_SUCCESS",
  //             token: "${token}", // token 값을 문자열로 삽입
  //             user: ${JSON.stringify(user)}, // user 객체를 JSON 문자열로 삽입
  //           }));
  //         }
  //         true;
  //     `);
  //         }
  //       } catch (backendError: any) {
  //         console.error(
  //           'Backend API call failed:',
  //           backendError.response?.data || backendError.message,
  //         );
  //         Alert.alert(
  //           '로그인 오류',
  //           `백엔드 로그인 실패: ${
  //             backendError.response?.data?.message || backendError.message
  //           }`,
  //         );
  //       }
  //     } else {
  //       Alert.alert('로그인 실패', 'Google ID Token을 얻을 수 없습니다.');
  //     }
  //   } catch (error: any) {
  //     if (error.code === statusCodes.SIGN_IN_CANCELLED) {
  //       // user cancelled the login flow
  //       Alert.alert('로그인 취소', '사용자가 로그인 흐름을 취소했습니다.');
  //     } else if (error.code === statusCodes.IN_PROGRESS) {
  //       // operation (e.g. sign in) is in progress already
  //       Alert.alert('로그인 진행 중', '이미 로그인 작업이 진행 중입니다.');
  //     } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
  //       // play services not available or outdated
  //       Alert.alert(
  //         'Google Play 서비스 없음',
  //         'Google Play 서비스가 없거나 오래되었습니다.',
  //       );
  //     } else {
  //       // some other error happened
  //       console.error('Google Sign-In Error:', error);
  //       Alert.alert(
  //         '로그인 오류',
  //         `Google 로그인 중 오류가 발생했습니다: ${error.message}`,
  //       );
  //     }
  //   }
  // };

  const _signOut = async () => {
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
      await AsyncStorage.removeItem('userToken');
      Alert.alert('로그아웃 성공', '성공적으로 로그아웃되었습니다.');
      // Optionally, send a message to the webview to clear its state
      webViewRef.current?.postMessage(
        JSON.stringify({ type: 'LOGOUT_SUCCESS' }),
      );
    } catch (error: any) {
      console.error('Google Sign-Out Error:', error);
      Alert.alert(
        '로그아웃 오류',
        `로그아웃 중 오류가 발생했습니다: ${error.message}`,
      );
    }
  };



  // "퐁" 받기
  const handleWebMessage = useCallback((event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('[App] 웹으로부터 메시지 받음:', message);

      if (message.type === 'PONG') {
        Alert.alert('성공!', '웹으로부터 PONG 메시지를 받았습니다!');
      } else if (message.type === 'CUSTOM_LOG') { // CUSTOM_LOG 처리
        console.log(message.payload.message, ...(message.payload.args || []));
      }
    } catch (e) {
      console.error('[App] 메시지 파싱 오류:', e);
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.buttonContainer}>
        <Button title="Google 로그인" onPress={_signIn} />
        <Button title="로그아웃" onPress={_signOut} />
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webView}
        onMessage={handleWebMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        // @ts-ignore
        onConsoleMessage={(event) => {
          console.log('[WebView Console]', event.nativeEvent.message);
        }}
        onLoadError={(syntheticEvent: any) => { // 다시 any 타입으로 변경
          const { nativeEvent } = syntheticEvent;
          console.error('[WebView Load Error]', nativeEvent.code, nativeEvent.description);
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
