import Taro from '@tarojs/taro';
import { Text, View } from '@tarojs/components';
import { useRef, useState } from 'react';
import { AppIcon } from './AppIcon';

const HIDDEN_ROUTES = new Set(['pages/login/index', 'pages/assistant/index']);
const FAB_WIDTH = 60;
const FAB_HEIGHT = 68;
const FAB_MARGIN = 10;
const CLICK_MOVE_THRESHOLD = 8;

function currentRoute() {
  const pages = Taro.getCurrentPages();
  return pages[pages.length - 1]?.route ?? '';
}

export function AiAssistantFab() {
  const route = currentRoute();
  const systemInfo = Taro.getSystemInfoSync();
  const safeBottom = systemInfo.safeArea
    ? Math.max(0, systemInfo.screenHeight - systemInfo.safeArea.bottom)
    : 0;
  const initialLeft = Math.max(FAB_MARGIN, systemInfo.windowWidth - FAB_WIDTH - FAB_MARGIN);
  const initialTop = Math.max(
    120,
    systemInfo.windowHeight - FAB_HEIGHT - safeBottom - 92,
  );
  const [position, setPosition] = useState({ left: initialLeft, top: initialTop });
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    startLeft: initialLeft,
    startTop: initialTop,
    moved: false,
  });

  if (HIDDEN_ROUTES.has(route)) {
    return null;
  }

  return (
    <View
      className="assistant-fab"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      onTouchStart={(event) => {
        const touch = (event as typeof event & { touches: Array<{ clientX: number; clientY: number }> }).touches[0];
        dragStateRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          startLeft: position.left,
          startTop: position.top,
          moved: false,
        };
      }}
      onTouchMove={(event) => {
        const touch = (event as typeof event & { touches: Array<{ clientX: number; clientY: number }> }).touches[0];
        const deltaX = touch.clientX - dragStateRef.current.startX;
        const deltaY = touch.clientY - dragStateRef.current.startY;
        const nextLeft = Math.min(
          systemInfo.windowWidth - FAB_WIDTH - FAB_MARGIN,
          Math.max(FAB_MARGIN, dragStateRef.current.startLeft + deltaX),
        );
        const nextTop = Math.min(
          systemInfo.windowHeight - FAB_HEIGHT - safeBottom - FAB_MARGIN,
          Math.max(88, dragStateRef.current.startTop + deltaY),
        );

        if (Math.abs(deltaX) > CLICK_MOVE_THRESHOLD || Math.abs(deltaY) > CLICK_MOVE_THRESHOLD) {
          dragStateRef.current.moved = true;
        }

        setPosition({ left: nextLeft, top: nextTop });
      }}
      onTouchEnd={() => {
        if (!dragStateRef.current.moved) {
          Taro.navigateTo({ url: '/pages/assistant/index' });
        }
      }}
    >
      <View className="assistant-fab-icon">
        <AppIcon name="botMessageSquare" size={22} className="icon-white" />
      </View>
      <Text className="assistant-fab-text">助手</Text>
    </View>
  );
}
