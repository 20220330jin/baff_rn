import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  BackHandler,
  ToastAndroid,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  GoogleSignin,
  statusCodes,
  SignInResponse,
} from '@react-native-google-signin/google-signin'; // Import SignInResponse type
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const AppContent = () => {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  // 뒤로가기 버튼의 첫 번째 클릭을 추적하기 위한 Ref
  const backPressedOnce = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);

  // 안드로이드의 물리적 뒤로가기 버튼 동작을 처리하기 위한 useEffect
  useEffect(() => {
    // 뒤로가기 버튼을 눌렀을 때 실행될 콜백 함수
    const backAction = () => {
      // WebView에서 뒤로가기가 가능한 경우
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true; // 기본 동작 차단
      }
      // backPressedOnce Ref가 true이면 (2초 안에 다시 눌렸다는 의미)
      if (backPressedOnce.current) {
        BackHandler.exitApp(); // 앱을 종료합니다.
        return true;
      }

      // 첫 번째 클릭이므로, Ref 값을 true로 설정합니다.
      backPressedOnce.current = true;
      // 사용자에게 안내 메시지를 짧게 보여줍니다.
      ToastAndroid.show(
        '한 번 더 뒤로가기 버튼을 누르면 종료됩니다.',
        ToastAndroid.SHORT,
      );

      // 2초 후에 Ref 값을 다시 false로 초기화합니다.
      setTimeout(() => {
        backPressedOnce.current = false;
      }, 2000);

      return true; // true를 반환하여 기본 동작(앱 즉시 종료)을 막습니다.
    };

    // BackHandler에 위에서 정의한 콜백 함수를 이벤트 리스너로 등록합니다.
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    // 컴포넌트가 언마운트될 때(화면에서 사라질 때) 등록했던 이벤트 리스너를 제거합니다.
    // (메모리 누수 방지를 위해 필수적인 과정입니다.)
    return () => backHandler.remove();
  }, [canGoBack]);

  // WebView의 네비게이션 상태 변경을 처리하는 함수 추가
  const handleNavigationStateChange = useCallback((navState: any) => {
    setCanGoBack(navState.canGoBack);
    // 페이지가 변경될 때마다 뒤로가기 상태 초기화
    backPressedOnce.current = false;
  }, []);

  // Make sure this IP is correct and includes the query parameter
  // const WEB_URL = 'http://192.168.139.167:5173/?isReactNativeApp=true';
  // const WEB_URL = 'http://192.168.35.228:5173/?isReactNativeApp=true';
  // const WEB_URL = 'https://baff-fe.vercel.app/?isReactNativeApp=true';
  const WEB_URL = 'https://change-up.me/?isReactNativeApp=true';
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
    }
  };

  const _signOut = async () => {
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
      await AsyncStorage.removeItem('userToken');
      // Optionally, send a message to the webview to clear its state
      webViewRef.current?.postMessage(
        JSON.stringify({ type: 'LOGOUT_SUCCESS' }),
      );
    } catch (error: any) {
      console.error('Google Sign-Out Error:', error);
    }
  };

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
        case 'REQUEST_GOOGLE_LOGOUT':
          console.log('REQUEST_GOOGLE_LOGOUT');
          _signOut();
          break;
        default:
          console.log('[App] <UNK> <UNK> <UNK> <UNK>');
      }
    } catch (error) {
      console.log(error);
    }
  }, []);

  return (
    // <View style={styles.container}>
    <View style={{
      flex: 1,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    }}>
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webView}
        onMessage={handleWebMessage}
        onNavigationStateChange={handleNavigationStateChange}
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

const App = () => {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  // container: {
  //   flex: 1,
  //   paddingTop: Platform.OS === 'android' ? 25 : 0,
  // },
  // buttonContainer: {
  //   padding: 10,
  //   backgroundColor: '#f0f0f0',
  //   flexDirection: 'row',
  //   justifyContent: 'space-around',
  // },
  webView: {
    flex: 1,
  },
});

export default App;
