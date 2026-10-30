import { PluginHost } from '@/plugins/pluginHost';

// Lightweight shared host: avoids importing bundled plugin definitions from indicator/scanner code.
export const pluginHost = new PluginHost();
