import { getRequestConfig } from 'next-intl/server';
import { messages } from '@/platform/i18n/messages';

// Vietnamese is the only locale (ADR §7.9); strings still go through resources.
export default getRequestConfig(async () => ({
  locale: 'vi',
  timeZone: 'Asia/Ho_Chi_Minh',
  messages,
}));
