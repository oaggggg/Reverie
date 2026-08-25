import { create } from "zustand";
import {
  getNotifications,
  getPrivateConversations,
  getPrivateHistory,
  sendPrivateMessage,
  getNotificationCounts,
} from "../api/notification";
import type {
  NotificationCategory,
  NotificationItem,
  PrivateAttachment,
  PrivateConversation,
  PrivateMessage,
} from "../api/types";
import { usePlayerStore } from "./playerStore";

const PAGE_SIZE = 30;
let listToken = 0;
let historyToken = 0;

interface NotificationState {
  category: NotificationCategory;
  loading: boolean;
  loadingMore: boolean;
  conversations: PrivateConversation[];
  conversationTotal: number;
  conversationHasMore: boolean;
  activeConversation: PrivateConversation | null;
  messages: PrivateMessage[];
  historyLoading: boolean;
  historyLoadingMore: boolean;
  historyHasMore: boolean;
  items: NotificationItem[];
  total: number;
  hasMore: boolean;
  cursor: number;
  unreadTotal: number;
  openNotifications: (category?: NotificationCategory) => Promise<void>;
  setCategory: (category: NotificationCategory) => Promise<void>;
  loadMore: () => Promise<void>;
  openConversation: (conversation: PrivateConversation) => Promise<void>;
  loadMoreHistory: () => Promise<void>;
  sendMessage: (
    content: string,
    attachment?: PrivateAttachment,
  ) => Promise<boolean>;
}

/** 消息中心以弹窗呈现：只负责收起搜索下拉并打开弹窗，不切换页面视图。 */
function showModal() {
  usePlayerStore.getState().setSearchOpen(false);
  usePlayerStore.setState({ showNotifications: true });
}

function currentUid() {
  return usePlayerStore.getState().profile?.userId ?? 0;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  category: "private",
  loading: false,
  loadingMore: false,
  conversations: [],
  conversationTotal: 0,
  conversationHasMore: false,
  activeConversation: null,
  messages: [],
  historyLoading: false,
  historyLoadingMore: false,
  historyHasMore: false,
  items: [],
  total: 0,
  hasMore: false,
  cursor: 0,
  unreadTotal: 0,

  openNotifications: async (category = get().category) => {
    const uid = currentUid();
    if (!uid) return;
    const token = ++listToken;
    historyToken++;
    void getNotificationCounts()
      .then((counts) => set({ unreadTotal: counts.total }))
      .catch(() => {});
    showModal();
    set({
      category,
      loading: true,
      loadingMore: false,
      activeConversation: null,
      messages: [],
      historyLoading: false,
      historyLoadingMore: false,
      historyHasMore: false,
      items: [],
      total: 0,
      hasMore: false,
      cursor: 0,
      ...(category === "private"
        ? {
            conversations: [],
            conversationTotal: 0,
            conversationHasMore: false,
          }
        : {}),
    });
    try {
      if (category === "private") {
        const result = await getPrivateConversations(uid, PAGE_SIZE, 0);
        if (token !== listToken || get().category !== category) return;
        set({
          conversations: result.conversations,
          conversationTotal: result.total,
          conversationHasMore: result.hasMore,
          loading: false,
        });
        if (result.conversations[0]) {
          await get().openConversation(result.conversations[0]);
        }
        return;
      }
      const result = await getNotifications(category, uid, PAGE_SIZE, 0);
      if (token !== listToken || get().category !== category) return;
      set({
        items: result.items,
        total: result.total,
        hasMore: result.hasMore,
        cursor: result.nextCursor,
        loading: false,
      });
    } catch {
      if (token !== listToken || get().category !== category) return;
      set({ loading: false });
      usePlayerStore.getState().toast("加载消息中心失败", "error");
    }
  },

  setCategory: async (category) => {
    if (category === get().category && !get().loading) return;
    await get().openNotifications(category);
  },

  loadMore: async () => {
    const uid = currentUid();
    const state = get();
    if (!uid || state.loading || state.loadingMore) return;
    const category = state.category;
    const token = listToken;
    if (category === "private") {
      if (!state.conversationHasMore) return;
      set({ loadingMore: true });
      try {
        const result = await getPrivateConversations(
          uid,
          PAGE_SIZE,
          state.conversations.length,
        );
        if (token !== listToken || get().category !== category) return;
        set((current) => ({
          conversations: [...current.conversations, ...result.conversations],
          conversationTotal: result.total,
          conversationHasMore: result.hasMore,
          loadingMore: false,
        }));
      } catch {
        if (token !== listToken || get().category !== category) return;
        set({ loadingMore: false });
        usePlayerStore.getState().toast("加载更多私信失败", "error");
      }
      return;
    }
    if (!state.hasMore) return;
    set({ loadingMore: true });
    try {
      const result = await getNotifications(
        category,
        uid,
        PAGE_SIZE,
        state.cursor,
      );
      if (token !== listToken || get().category !== category) return;
      set((current) => ({
        items: [...current.items, ...result.items],
        total: result.total,
        hasMore: result.hasMore,
        cursor: result.nextCursor,
        loadingMore: false,
      }));
    } catch {
      if (token !== listToken || get().category !== category) return;
      set({ loadingMore: false });
      usePlayerStore.getState().toast("加载更多通知失败", "error");
    }
  },

  openConversation: async (conversation) => {
    const token = ++historyToken;
    set({
      activeConversation: conversation,
      messages: [],
      historyLoading: true,
      historyLoadingMore: false,
      historyHasMore: false,
      conversations: get().conversations.map((item) =>
        item.user.userId === conversation.user.userId
          ? { ...item, unreadCount: 0 }
          : item,
      ),
    });
    try {
      const result = await getPrivateHistory(conversation.user.userId);
      if (
        token !== historyToken ||
        get().activeConversation?.user.userId !== conversation.user.userId
      )
        return;
      set({
        messages: result.messages,
        historyHasMore: result.hasMore,
        historyLoading: false,
      });
    } catch {
      if (token !== historyToken) return;
      set({ historyLoading: false });
      usePlayerStore.getState().toast("加载私信内容失败", "error");
    }
  },

  loadMoreHistory: async () => {
    const state = get();
    const conversation = state.activeConversation;
    if (
      !conversation ||
      !state.historyHasMore ||
      state.historyLoading ||
      state.historyLoadingMore
    )
      return;
    const token = historyToken;
    const before = state.messages[0]?.time ?? 0;
    set({ historyLoadingMore: true });
    try {
      const result = await getPrivateHistory(
        conversation.user.userId,
        PAGE_SIZE,
        before,
      );
      if (
        token !== historyToken ||
        get().activeConversation?.user.userId !== conversation.user.userId
      )
        return;
      set((current) => ({
        messages: [...result.messages, ...current.messages],
        historyHasMore: result.hasMore,
        historyLoadingMore: false,
      }));
    } catch {
      if (token !== historyToken) return;
      set({ historyLoadingMore: false });
      usePlayerStore.getState().toast("加载更早私信失败", "error");
    }
  },

  sendMessage: async (content, attachment) => {
    const conversation = get().activeConversation;
    const uid = currentUid();
    const message = content.trim();
    if (!conversation || !uid || (!message && !attachment)) return false;
    try {
      await sendPrivateMessage(conversation.user.userId, message, attachment);
      const time = Date.now();
      const sent: PrivateMessage = {
        id: `local-${time}`,
        fromUserId: uid,
        toUserId: conversation.user.userId,
        content: message || "分享了一项内容",
        time,
        resourceTitle: attachment?.title,
        resourceType: attachment?.type,
        resourceId: attachment?.id,
      };
      set((state) => ({
        messages:
          state.activeConversation?.user.userId === conversation.user.userId
            ? [...state.messages, sent]
            : state.messages,
        conversations: state.conversations.map((item) =>
          item.user.userId === conversation.user.userId
            ? {
                ...item,
                preview: attachment
                  ? `${sent.content} · ${attachment.title}`
                  : sent.content,
                time,
              }
            : item,
        ),
      }));
      return true;
    } catch {
      usePlayerStore.getState().toast("发送私信失败", "error");
      return false;
    }
  },
}));
