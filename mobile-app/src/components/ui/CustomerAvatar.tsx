import React, { useState } from 'react';
import { View, Text, Image, StyleProp, ViewStyle, TextStyle } from 'react-native';

/**
 * Customer picture with the fallback chain the data layer promises:
 *   remote URL → durable local copy → the initial-letter circle the list always had.
 *
 * Like DateField it carries NO styling of its own — the host passes the very
 * `avatar` / `avatarText` styles it already uses, so nothing moves on screen. If the
 * image fails to load (file reclaimed, bad URL) it silently drops to the initial.
 */
export const CustomerAvatar = ({ name, uri, style, textStyle }: {
  name: string;
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) => {
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = !!uri && failed !== uri;
  return (
    <View style={[style, { overflow: 'hidden' }]}>
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: '100%', height: '100%' }}
          onError={() => setFailed(uri as string)}
          accessibilityLabel={`Photo of ${name}`}
        />
      ) : (
        <Text style={textStyle}>{(name.trim().charAt(0) || '?').toUpperCase()}</Text>
      )}
    </View>
  );
};
