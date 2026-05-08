import { View, Text } from '@tarojs/components';
import type { PropsWithChildren } from 'react';

interface PageShellProps extends PropsWithChildren {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  variant?: 'plain' | 'gradient';
}

export function PageShell(props: PageShellProps) {
  return (
    <View className="screen">
      <View className={`hero ${props.variant === 'plain' ? 'plain' : 'gradient'}`}>
        {props.eyebrow ? <Text className="eyebrow">{props.eyebrow}</Text> : null}
        <View className="hero-title">{props.title}</View>
        {props.subtitle ? <View className="hero-subtitle">{props.subtitle}</View> : null}
      </View>
      {props.children}
    </View>
  );
}
