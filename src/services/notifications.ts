import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { City } from '../domain/cities';
import {
  addCalendarDays,
  dateInTimeZone,
  getPrayerTimesForDate,
  prayerTimeInstant,
  type CalculationMethod,
} from '../domain/prayer';

const SCHEDULE_DAYS = 14;
const ALARM_TAG = 'mishkahAlarm';

export async function schedulePrayerReminders(
  city: City,
  options: {
    fajrEnabled: boolean;
    iftarEnabled: boolean;
    fajrLeadMinutes: number;
    method: CalculationMethod;
    requestPermission?: boolean;
  },
): Promise<number> {
  if (Platform.OS === 'web') {
    throw new Error('Prayer reminders are available in the iOS and Android apps.');
  }

  let permission = await Notifications.getPermissionsAsync();
  if (options.requestPermission && !permission.granted) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if ((options.fajrEnabled || options.iftarEnabled) && !permission.granted) {
    throw new Error('Notification permission is needed to schedule prayer reminders.');
  }

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.content.data?.[ALARM_TAG] === true)
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );

  if (!options.fajrEnabled && !options.iftarEnabled) {
    return 0;
  }

  const today = dateInTimeZone(new Date(), city.timeZone);
  const notifications: Promise<string>[] = [];
  for (let offset = 0; offset < SCHEDULE_DAYS; offset += 1) {
    const localDate = addCalendarDays(today, offset);
    const times = getPrayerTimesForDate(city, localDate, options.method);

    if (options.fajrEnabled) {
      const triggerDate = prayerTimeInstant(city, localDate, times.Fajr - options.fajrLeadMinutes);
      if (triggerDate.getTime() > Date.now()) {
        notifications.push(
          Notifications.scheduleNotificationAsync({
            content: {
              title: 'A gentle suhoor reminder',
              body: `Fajr is approaching in ${options.fajrLeadMinutes} minutes. Water, suhoor, and your dua checklist are ready.\nby LIXZON`,
              data: { [ALARM_TAG]: true, kind: 'fajr', cityId: city.id },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
          }),
        );
      }
    }

    if (options.iftarEnabled) {
      const triggerDate = prayerTimeInstant(city, localDate, times.Maghrib);
      if (triggerDate.getTime() > Date.now()) {
        notifications.push(
          Notifications.scheduleNotificationAsync({
            content: {
              title: 'Maghrib — time for iftar',
              body: 'Begin gently with water and dates if you wish. Make dua, pray, and enjoy a balanced meal.\nby LIXZON',
              data: { [ALARM_TAG]: true, kind: 'iftar', cityId: city.id },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
          }),
        );
      }
    }
  }

  try {
    await Promise.all(notifications);
  } catch (error) {
    const partialSchedule = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      partialSchedule
        .filter((request) => request.content.data?.[ALARM_TAG] === true)
        .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
    );
    throw error;
  }

  return notifications.length;
}
