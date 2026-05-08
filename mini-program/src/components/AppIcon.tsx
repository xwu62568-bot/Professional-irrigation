import { Image } from '@tarojs/components';
import alertCircle from 'lucide-static/icons/alert-circle.svg';
import alertTriangle from 'lucide-static/icons/alert-triangle.svg';
import battery from 'lucide-static/icons/battery.svg';
import bell from 'lucide-static/icons/bell.svg';
import building2 from 'lucide-static/icons/building-2.svg';
import calendar from 'lucide-static/icons/calendar.svg';
import checkCircle2 from 'lucide-static/icons/check-circle-2.svg';
import chevronRight from 'lucide-static/icons/chevron-right.svg';
import clock from 'lucide-static/icons/clock.svg';
import cloudRain from 'lucide-static/icons/cloud-rain.svg';
import database from 'lucide-static/icons/database.svg';
import droplets from 'lucide-static/icons/droplets.svg';
import gauge from 'lucide-static/icons/gauge.svg';
import helpCircle from 'lucide-static/icons/help-circle.svg';
import info from 'lucide-static/icons/info.svg';
import logOut from 'lucide-static/icons/log-out.svg';
import mapPin from 'lucide-static/icons/map-pin.svg';
import pause from 'lucide-static/icons/pause.svg';
import play from 'lucide-static/icons/play.svg';
import radio from 'lucide-static/icons/radio.svg';
import search from 'lucide-static/icons/search.svg';
import settings from 'lucide-static/icons/settings.svg';
import signal from 'lucide-static/icons/signal.svg';
import smartphone from 'lucide-static/icons/smartphone.svg';
import square from 'lucide-static/icons/square.svg';
import trendingUp from 'lucide-static/icons/trending-up.svg';
import user from 'lucide-static/icons/user.svg';
import wifi from 'lucide-static/icons/wifi.svg';
import wifiOff from 'lucide-static/icons/wifi-off.svg';
import filter from 'lucide-static/icons/filter.svg';

const iconMap = {
  alertCircle,
  alertTriangle,
  battery,
  bell,
  building2,
  calendar,
  checkCircle2,
  chevronRight,
  clock,
  cloudRain,
  database,
  droplets,
  filter,
  gauge,
  helpCircle,
  info,
  logOut,
  mapPin,
  pause,
  play,
  radio,
  search,
  settings,
  signal,
  smartphone,
  square,
  trendingUp,
  user,
  wifi,
  wifiOff,
} as const;

export type AppIconName = keyof typeof iconMap;

interface AppIconProps {
  name: AppIconName;
  size?: number;
  className?: string;
}

export function AppIcon({ name, size = 18, className = '' }: AppIconProps) {
  return (
    <Image
      className={`app-icon ${className}`.trim()}
      src={iconMap[name]}
      style={{ width: `${size}px`, height: `${size}px` }}
      mode="aspectFit"
    />
  );
}
