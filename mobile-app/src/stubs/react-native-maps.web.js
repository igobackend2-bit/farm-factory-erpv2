/**
 * Web stub for react-native-maps.
 * Exports no-op components so Metro can bundle on web without crashing.
 */
import React from 'react';
import { View } from 'react-native';

const MapView = ({ children, style }) => React.createElement(View, { style }, children);
MapView.Animated = MapView;

const Marker = () => null;
const Polyline = () => null;
const Polygon = () => null;
const Circle = () => null;
const Callout = ({ children }) => React.createElement(View, null, children);
const CalloutSubview = ({ children }) => React.createElement(View, null, children);
const Overlay = () => null;
const Heatmap = () => null;
const Geojson = () => null;

export const PROVIDER_DEFAULT = null;
export const PROVIDER_GOOGLE = 'google';

export {
  MapView,
  Marker,
  Polyline,
  Polygon,
  Circle,
  Callout,
  CalloutSubview,
  Overlay,
  Heatmap,
  Geojson,
};

export default MapView;
