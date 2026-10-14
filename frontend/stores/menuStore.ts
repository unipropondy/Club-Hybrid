import { create } from 'zustand';
import { API_URL } from '@/constants/Config';

interface MenuState {
  kitchens: any[];
  dishGroups: Record<string, any[]>;
  dishesByGroup: Record<string, any[]>;
  allDishes: any[];
  modifierCache: Record<string, any[]>;
  lastFetched: number | null;
  isLoading: boolean;

  fetchMenu: () => Promise<void>;
  fetchGroups: (kitchenId: string) => Promise<any[]>;
  fetchDishes: (groupId: string) => Promise<any[]>;
  fetchModifiersForGroup: (groupId: string) => Promise<void>;
  clearCache: () => void;
  forceRefreshMenu: () => Promise<void>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  kitchens: [],
  dishGroups: {},
  dishesByGroup: {},
  allDishes: [],
  modifierCache: {},
  lastFetched: null,
  isLoading: false,

  fetchMenu: async () => {
    const { lastFetched, kitchens, allDishes } = get();
    // 🛡️ Auto-refresh cache if cached dishes do not contain the TakeawayCharge property
    const needsRefetch = allDishes.length > 0 && !allDishes.some(d => 'TakeawayCharge' in d);
    if (!needsRefetch && lastFetched && kitchens.length > 0 && Date.now() - lastFetched < 600000) {
      return;
    }

    set({ isLoading: true });
    try {
      // 1. Fetch kitchens
      const kRes = await fetch(`${API_URL}/api/menu/kitchens`);
      const kData = await kRes.json();
      const rawKitchens = Array.isArray(kData) ? kData.filter((k: any) => k.KitchenTypeName && !k.KitchenTypeName.includes("TEST")) : [];
      // 🟢 Deduplicate kitchens by CategoryId (since backend returns CategoryId)
      const kitchensData = Array.from(
        new Map(rawKitchens.map((k: any) => [k.CategoryId, k])).values()
      );

      // 2. Fetch all dishes (for search)
      const dRes = await fetch(`${API_URL}/api/menu/dishes/all`);
      const dData = await dRes.json();
      const allDishesRaw = Array.isArray(dData) ? dData : [];
      
      // Deduplicate dishes by DishId
      const allDishesData = Array.from(
        new Map(allDishesRaw.map((d: any) => [d.DishId || d.id, d])).values()
      );

      // 🛡️ Cache kitchens, dish groups, and dishes into local SQLite for offline waiter tablet access
      try {
        const { MenuRepository } = require('../db/MenuRepository');
        MenuRepository.saveKitchenCategories(kitchensData).catch(() => {});

        const cacheItems = allDishesData.map((d: any) => ({
          dish_id: d.DishId || d.id,
          dish_name: d.Name || d.dish_name || '',
          category_id: d.DishGroupId || d.categoryId || '',
          category_name: d.DishGroupName || d.categoryName || '',
          kitchen_id: d.KitchenTypeId || d.CategoryId || '',
          kitchen_name: d.KitchenTypeName || '',
          price: Number(d.currentcost || d.Cost || d.price || 0),
          is_available: d.IsActive !== false && d.IsActive !== 0,
          image_url: d.Imageid || d.imageUrl || '',
          sort_code: Number(d.SordCode || d.sort_code || 0),
          updated_at: new Date().toISOString(),
        }));
        MenuRepository.saveMenuDishes(cacheItems).catch((err: any) =>
          console.warn('[MenuStore] SQLite cache error:', err)
        );
      } catch (cacheErr) {
        // Non-blocking
      }

      set({ 
        kitchens: kitchensData, 
        allDishes: allDishesData,
        lastFetched: Date.now(),
        isLoading: false 
      });
    } catch (error) {
      console.warn("Failed to fetch online menu, falling back to local SQLite cache:", error);
      try {
        const { MenuRepository } = require('../db/MenuRepository');
        const cachedKitchens = await MenuRepository.getCachedKitchens();
        const cached = await MenuRepository.getCachedMenu();
        if (cached && cached.length > 0) {
          console.log(`📦 [MenuStore] Restored ${cached.length} active dishes from SQLite cache for offline usage.`);
          const mappedDishes = cached.map((c: any) => ({
            DishId: c.dish_id,
            Name: c.dish_name,
            DishGroupId: c.category_id,
            DishGroupName: c.category_name,
            currentcost: c.price,
            Cost: c.price,
            Price: c.price,
            IsActive: c.is_available,
            Imageid: c.image_url,
            KitchenTypeName: c.kitchen_name,
            SordCode: c.sort_code,
          }));

          const kitchensToUse = (cachedKitchens && cachedKitchens.length > 0)
            ? cachedKitchens
            : Array.from(new Set(cached.map((c: any) => c.kitchen_name || c.category_name || 'General'))).map((catName, idx) => ({
                CategoryId: `offline-cat-${idx}`,
                KitchenTypeName: catName,
              }));

          set({
            kitchens: kitchensToUse,
            allDishes: mappedDishes,
            isLoading: false,
          });
          return;
        }
      } catch (cErr) {
        console.error("SQLite menu cache lookup failed:", cErr);
      }
      set({ isLoading: false });
    }
  },

  fetchGroups: async (kitchenId) => {
    const { dishGroups } = get();
    if (dishGroups[kitchenId]) return dishGroups[kitchenId];

    try {
      const res = await fetch(`${API_URL}/api/menu/dishgroups/${kitchenId}`);
      const data = await res.json();
      const rawGroups = Array.isArray(data) ? data : [];
      // 🟢 Deduplicate groups by DishGroupId
      const groups = Array.from(
        new Map(rawGroups.map((g: any) => [g.DishGroupId || g.id, g])).values()
      );
      
      // Cache groups locally in SQLite
      try {
        const { MenuRepository } = require('../db/MenuRepository');
        MenuRepository.saveDishGroups(groups, kitchenId).catch(() => {});
      } catch (_) {}

      set((state) => ({
        dishGroups: { ...state.dishGroups, [kitchenId]: groups }
      }));
      return groups;
    } catch (error) {
      console.warn(`Failed to fetch groups for kitchen ${kitchenId}, checking local cache:`, error);
      try {
        const { MenuRepository } = require('../db/MenuRepository');
        const cachedGroups = await MenuRepository.getCachedDishGroups(kitchenId);
        if (cachedGroups && cachedGroups.length > 0) {
          set((state) => ({
            dishGroups: { ...state.dishGroups, [kitchenId]: cachedGroups }
          }));
          return cachedGroups;
        }
      } catch (_) {}

      const allDishes = (get().allDishes || []).filter((d: any) => d.IsActive !== false && d.IsActive !== 0);
      const distinctGroups = Array.from(
        new Set(allDishes.map((d: any) => d.DishGroupId || d.categoryId).filter(Boolean))
      ).map((gid) => {
        const sample = allDishes.find((d: any) => (d.DishGroupId || d.categoryId) === gid);
        return {
          DishGroupId: gid,
          DishGroupName: sample?.DishGroupName || sample?.categoryName || 'Group',
        };
      });
      if (distinctGroups.length > 0) {
        set((state) => ({
          dishGroups: { ...state.dishGroups, [kitchenId]: distinctGroups }
        }));
        return distinctGroups;
      }
      return [];
    }
  },

  fetchDishes: async (groupId) => {
    const { dishesByGroup, modifierCache } = get();
    const groupDishes = dishesByGroup[groupId];
    // 🛡️ Auto-refresh cache if cached group dishes do not contain the TakeawayCharge property
    const needsRefetch = groupDishes && groupDishes.length > 0 && !groupDishes.some(d => 'TakeawayCharge' in d);
    if (groupDishes && !needsRefetch) {
      const hasAnyModifierCached = groupDishes.some(d => modifierCache[d.DishId || d.id] !== undefined);
      if (!hasAnyModifierCached) {
        get().fetchModifiersForGroup(groupId);
      }
      return groupDishes;
    }

    try {
      const res = await fetch(`${API_URL}/api/menu/dishes/group/${groupId}`);
      const data = await res.json();
      const dishesRaw = Array.isArray(data) ? data : [];
      
      // Deduplicate dishes by DishId
      const dishes = Array.from(
        new Map(dishesRaw.map((d: any) => [d.DishId || d.id, d])).values()
      );

      set((state) => ({
        dishesByGroup: { ...state.dishesByGroup, [groupId]: dishes }
      }));

      // 🚀 BACKGROUND PRE-FETCH: Load all modifiers for this group
      get().fetchModifiersForGroup(groupId);

      return dishes;
    } catch (error) {
      console.warn(`Failed to fetch dishes for group ${groupId}, checking local cache:`, error);
      const fallbackDishes = (get().allDishes || []).filter(
        (d: any) => String(d.DishGroupId || d.categoryId) === String(groupId) && d.IsActive !== false && d.IsActive !== 0
      );
      if (fallbackDishes.length > 0) {
        set((state) => ({
          dishesByGroup: { ...state.dishesByGroup, [groupId]: fallbackDishes }
        }));
        return fallbackDishes;
      }
      return [];
    }
  },

  fetchModifiersForGroup: async (groupId) => {
    try {
      const res = await fetch(`${API_URL}/api/menu/modifiers/group/${groupId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const newModifiers: Record<string, any[]> = {};
        data.forEach(m => {
          if (!newModifiers[m.DishId]) newModifiers[m.DishId] = [];
          newModifiers[m.DishId].push(m);
        });
        
        set(state => ({
          modifierCache: { ...state.modifierCache, ...newModifiers }
        }));
      }
    } catch (err) {
      console.error("Failed to fetch group modifiers:", err);
    }
  },

  clearCache: () => set({ kitchens: [], dishGroups: {}, dishesByGroup: {}, allDishes: [], modifierCache: {}, lastFetched: null }),

  forceRefreshMenu: async () => {
    set({ isLoading: true });
    try {
      await fetch(`${API_URL}/api/menu/clear-cache`, { method: 'POST' });
    } catch (err) {
      console.warn("Backend cache clear failed:", err);
    }
    get().clearCache();
    await get().fetchMenu();
  },
}));
