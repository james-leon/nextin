"use client";

import { createContext, type ReactNode } from "react";

/**
 * Bouton « afficher la barre latérale » fourni par le gabarit à barre latérale à la barre de navigation.
 * Module minuscule : les pages client (budget < 200 Ko) n'importent pas le gabarit du personnel.
 */
export const SidebarToggleSlot = createContext<ReactNode>(null);
