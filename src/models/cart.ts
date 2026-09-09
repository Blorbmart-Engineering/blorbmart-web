/* ═══════════════════════════════════════════════════════════════════════
   The basket line — a port of lib/data/models/cart.dart.

   Two lines of the same dish with different add-ons are genuinely different
   lines, which is what `signature` exists to decide.
   ═══════════════════════════════════════════════════════════════════════ */

import { asDouble, asInt, asString, clamp } from '../lib/format'
import {
  effectivePrice,
  itemImage,
  verticalFromId,
  type MenuItem,
  type Vertical,
} from './catalog'

export interface SelectedAddon {
  group: string
  name: string
  price: number
}

export interface CartLine {
  itemId: string
  name: string
  /**
   * Base price at the moment it was added, before add-ons. Snapshotting the
   * price means a vendor editing their menu mid-session cannot change what is
   * already in someone's basket without them seeing it at checkout.
   */
  unitPrice: number
  quantity: number
  storeId: string
  storeName: string
  image: string
  addons: SelectedAddon[]
  note: string
  packagingFee: number
  vertical: Vertical
}

export function selectedAddonFromMap(m: Record<string, unknown>): SelectedAddon {
  return {
    group: asString(m.group),
    name: asString(m.name),
    price: asDouble(m.price),
  }
}

export function addonTotal(line: CartLine): number {
  return line.addons.reduce((sum, a) => sum + a.price, 0)
}

export function lineUnitPrice(line: CartLine): number {
  return line.unitPrice + addonTotal(line) + line.packagingFee
}

export function lineTotal(line: CartLine): number {
  return lineUnitPrice(line) * line.quantity
}

/** Identity for merging. Same dish + same add-ons + same note = same line. */
export function lineSignature(line: CartLine): string {
  const a = line.addons.map((e) => `${e.group}:${e.name}`).sort()
  return `${line.itemId}|${a.join(',')}|${line.note.trim().toLowerCase()}`
}

export function addonSummary(line: CartLine): string {
  return line.addons.length ? line.addons.map((a) => a.name).join(', ') : ''
}

export function cartLineToMap(line: CartLine): Record<string, unknown> {
  return {
    itemId: line.itemId,
    productId: line.itemId,
    name: line.name,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    storeId: line.storeId,
    storeName: line.storeName,
    image: line.image,
    images: line.image ? [line.image] : [],
    addons: line.addons.map((a) => ({ group: a.group, name: a.name, price: a.price })),
    note: line.note,
    packagingFee: line.packagingFee,
    vertical: line.vertical,
    lineTotal: lineTotal(line),
  }
}

export function cartLineFromMap(m: Record<string, unknown>): CartLine {
  const rawAddons = m.addons
  return {
    itemId: asString(m.itemId ?? m.productId),
    name: asString(m.name, 'Item'),
    unitPrice: asDouble(m.unitPrice ?? m.price),
    quantity: clamp(asInt(m.quantity, 1), 1, 99),
    storeId: asString(m.storeId),
    storeName: asString(m.storeName),
    image: asString(m.image),
    addons: Array.isArray(rawAddons)
      ? rawAddons
          .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
          .map(selectedAddonFromMap)
      : [],
    note: asString(m.note),
    packagingFee: asDouble(m.packagingFee),
    vertical: verticalFromId(m.vertical),
  }
}

/** Builds a line from a menu item and the choices made in the customiser. */
export function cartLineFrom(
  item: MenuItem,
  { quantity = 1, addons = [], note = '' }: {
    quantity?: number
    addons?: SelectedAddon[]
    note?: string
  } = {},
): CartLine {
  return {
    itemId: item.id,
    name: item.name,
    unitPrice: effectivePrice(item),
    quantity,
    storeId: item.storeId,
    storeName: item.storeName,
    image: itemImage(item),
    addons,
    note,
    packagingFee: item.packagingFee,
    vertical: item.vertical,
  }
}
