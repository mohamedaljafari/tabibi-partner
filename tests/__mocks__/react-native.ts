/**
 * موك مبسط لوحدة react-native لبيئة اختبار Vitest.
 * لا يحاول محاكاة React Native كاملًا؛ يوفر فقط ما تعتمد عليه
 * مكتبات lib التطبيقية (Platform وAlert ونحوها) دون أي تنفيذ أصلي.
 */

export const Platform = {
  OS: "web" as const,
  select: <T,>(specifics: Record<string, T>) => specifics.web ?? specifics.default,
} as const;

export const Alert = {
  alert: () => {
    /* لا شيء في بيئة الاختبار */
  },
};

export const Linking = {
  openURL: async () => undefined,
  canOpenURL: async () => true,
};

export const Dimensions = {
  get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
  addEventListener: () => ({ remove: () => undefined }),
};

export const StyleSheet = {
  create: <S extends Record<string, unknown>>(styles: S) => styles,
  flatten: (style: unknown) => (Array.isArray(style) ? Object.assign({}, ...style) : style ?? {}),
};

export const PixelRatio = { get: () => 2, getFontScale: () => 1, roundToNearestPixel: (p: number) => p };

export type ViewStyle = Record<string, unknown>;
export type TextStyle = Record<string, unknown>;
export type ImageStyle = Record<string, unknown>;
