import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

export async function registerForPushNotificationsAsync(userId) {
  let token;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('¡Fallo al obtener el token para notificaciones!');
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    console.log('Debes usar un dispositivo físico para notificaciones push');
  }

  if (token && userId) {
    // Guardamos el token en el perfil del usuario en Supabase
    await supabase
      .from('profiles')
      .update({ expo_push_token: token })
      .eq('id', userId);
  }

  return token;
}