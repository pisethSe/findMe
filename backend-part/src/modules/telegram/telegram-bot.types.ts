/**
 * Structural view of the Telegram Bot API objects this surface reads. Only the
 * fields the administrator bot consumes are declared; everything else in an
 * update stays opaque and unused.
 */
export interface TelegramBotUser {
  id?: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
}

export interface TelegramBotChat {
  id?: number;
  type?: string;
}

export interface TelegramBotMessage {
  message_id?: number;
  from?: TelegramBotUser;
  chat?: TelegramBotChat;
  text?: string;
}

export interface TelegramBotUpdate {
  update_id?: number;
  message?: TelegramBotMessage;
}

export interface TelegramSupportCommand {
  name: string;
  argument: string | null;
}

export interface TelegramBotReply {
  chatId: string;
  text: string;
}

export interface TelegramPendingListingSummary {
  id: string;
  title: string;
  landlordName: string;
  waitingHours: number;
}

export interface TelegramOpenReportSummary {
  id: string;
  listingId: string;
  reason: string;
  ageHours: number;
}

/**
 * Inventory counts the bot reports. They are aggregate numbers only: no
 * landlord, student, reporter, or contact detail is ever selected for a count.
 */
export interface TelegramSupportCounts {
  pendingListings: number;
  openReports: number;
  publishedListings: number;
  activeLandlords: number;
}
