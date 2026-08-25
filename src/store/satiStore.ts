import { create } from "zustand";
import {
  getMoreSatiResources,
  getSatiResources,
  getSatiTags,
  getSatiTimeSceneResources,
  getSubscribedSatiResources,
  subscribeSatiResource,
} from "../api/sati.ts";
import type { SatiResource, SatiTag } from "../api/types.ts";
import { usePlayerStore } from "./playerStore.ts";

let requestToken = 0;

interface SatiState {
  tags: SatiTag[];
  selectedTag: string;
  resources: SatiResource[];
  subscribed: SatiResource[];
  loading: boolean;
  error: string;
  load: () => Promise<void>;
  selectTag: (tag: string) => Promise<void>;
  toggle: (resource: SatiResource) => Promise<void>;
  loadMore: (resource: SatiResource) => Promise<void>;
}
export const useSatiStore = create<SatiState>((set, get) => ({
  tags: [],
  selectedTag: "",
  resources: [],
  subscribed: [],
  loading: false,
  error: "",
  load: async () => {
    const token = ++requestToken;
    set({ loading: true, error: "" });
    const [tags, resources, subscribed, scene] = await Promise.allSettled([
      getSatiTags(),
      getSatiResources(),
      getSubscribedSatiResources(),
      getSatiTimeSceneResources(),
    ]);
    if (token !== requestToken) return;
    const fallback = scene.status === "fulfilled" ? scene.value : [];
    set({
      tags: tags.status === "fulfilled" ? tags.value : [],
      resources:
        resources.status === "fulfilled" && resources.value.length
          ? resources.value
          : fallback,
      subscribed: subscribed.status === "fulfilled" ? subscribed.value : [],
      loading: false,
      error: resources.status === "rejected" ? "助眠资源暂时不可用" : "",
    });
  },
  selectTag: async (tag) => {
    const token = ++requestToken;
    set({ selectedTag: tag, loading: true });
    try {
      const resources = await getSatiResources(tag);
      if (token !== requestToken) return;
      set({ resources, loading: false });
    } catch (error) {
      if (token !== requestToken) return;
      set({
        loading: false,
        error: error instanceof Error ? error.message : "加载资源失败",
      });
    }
  },
  toggle: async (resource) => {
    try {
      await subscribeSatiResource(resource.id, resource.subscribed);
      const next = !resource.subscribed;
      set({
        resources: get().resources.map((item) =>
          item.id === resource.id ? { ...item, subscribed: next } : item,
        ),
        subscribed: next
          ? [...get().subscribed, { ...resource, subscribed: true }]
          : get().subscribed.filter((item) => item.id !== resource.id),
      });
      usePlayerStore
        .getState()
        .toast(next ? "已收藏资源" : "已取消收藏", "success");
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "收藏操作失败" });
    }
  },
  loadMore: async (resource) => {
    try {
      const more = await getMoreSatiResources(resource.id);
      set({
        resources: [
          ...get().resources,
          ...more.filter(
            (item) =>
              !get().resources.some((existing) => existing.id === item.id),
          ),
        ],
      });
    } catch {
      /* optional recommendation */
    }
  },
}));
