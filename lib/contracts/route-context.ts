// lib/types/route-context.ts

export type IdRouteContext = {
  params: Promise<{ id: string }>
}