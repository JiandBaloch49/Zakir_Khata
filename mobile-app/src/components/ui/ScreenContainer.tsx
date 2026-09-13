import React from 'react';
import { ScrollView, View, KeyboardAvoidingView, Platform, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  hasTabBar?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

// Inner component that calls useBottomTabBarHeight unconditionally (Rules of Hooks)
const ScreenContainerInner = ({
  children,
  scrollable,
  style,
  contentContainerStyle,
  bottomPadding,
}: {
  children: React.ReactNode;
  scrollable: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  bottomPadding: number;
}) => {
  if (!scrollable) {
    return (
      <View style={[style, { flex: 1, paddingBottom: bottomPadding }]}>
        {children}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={style}
        contentContainerStyle={[contentContainerStyle, { flexGrow: 1, paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Wrapper that safely reads tab bar height when hasTabBar=true
const WithTabBar = ({
  children,
  scrollable,
  style,
  contentContainerStyle,
  insetBottom,
}: {
  children: React.ReactNode;
  scrollable: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  insetBottom: number;
}) => {
  let tabBarHeight = 0;
  try {
    // This hook is only valid inside a Bottom Tab navigator.
    // We wrap it here so it is called unconditionally within this component.
    tabBarHeight = useBottomTabBarHeight(); // eslint-disable-line react-hooks/rules-of-hooks
  } catch (_) {
    tabBarHeight = 0;
  }

  const effectiveTabBarHeight = Math.max(tabBarHeight, 80) + 16;
  const bottomPadding = Math.max(insetBottom, 16) + effectiveTabBarHeight + 35;

  return (
    <ScreenContainerInner
      scrollable={scrollable}
      style={style}
      contentContainerStyle={contentContainerStyle}
      bottomPadding={bottomPadding}
    >
      {children}
    </ScreenContainerInner>
  );
};

export const ScreenContainer = ({
  children,
  scrollable = true,
  hasTabBar = false,
  style,
  contentContainerStyle,
}: ScreenContainerProps) => {
  const insets = useSafeAreaInsets();

  if (hasTabBar) {
    return (
      <WithTabBar
        scrollable={scrollable}
        style={style}
        contentContainerStyle={contentContainerStyle}
        insetBottom={insets.bottom}
      >
        {children}
      </WithTabBar>
    );
  }

  const bottomPadding = Math.max(insets.bottom, 16) + 35;

  return (
    <ScreenContainerInner
      scrollable={scrollable}
      style={style}
      contentContainerStyle={contentContainerStyle}
      bottomPadding={bottomPadding}
    >
      {children}
    </ScreenContainerInner>
  );
};
