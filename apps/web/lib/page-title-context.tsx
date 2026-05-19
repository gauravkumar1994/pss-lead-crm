"use client";

import { createContext, useContext } from "react";

export const PageTitleContext = createContext<(title: string) => void>(() => {});

export function usePageTitle() {
  return useContext(PageTitleContext);
}
