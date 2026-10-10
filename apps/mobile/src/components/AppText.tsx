import { forwardRef } from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet, type TextInputProps, type TextProps, type TextStyle } from 'react-native';

/**
 * Text / TextInput that render in Kanit. Custom fonts on Android don't synthesize weights,
 * so the requested fontWeight is mapped to the matching Kanit file instead.
 */
const FAMILY: Record<string, string> = {
  '100': 'Kanit_300Light',
  '200': 'Kanit_300Light',
  '300': 'Kanit_300Light',
  '400': 'Kanit_400Regular',
  normal: 'Kanit_400Regular',
  '500': 'Kanit_500Medium',
  '600': 'Kanit_600SemiBold',
  '700': 'Kanit_700Bold',
  bold: 'Kanit_700Bold',
  '800': 'Kanit_700Bold',
  '900': 'Kanit_700Bold',
};

function kanit(style: TextProps['style']): TextStyle {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  return { fontFamily: FAMILY[String(flat.fontWeight ?? '400')] ?? FAMILY['400'], fontWeight: 'normal' };
}

export const Text = forwardRef<RNText, TextProps>(function Text(props, ref) {
  return <RNText ref={ref} {...props} style={[props.style, kanit(props.style)]} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(props, ref) {
  return <RNTextInput ref={ref} {...props} style={[props.style, kanit(props.style)]} />;
});
