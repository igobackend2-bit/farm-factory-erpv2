import React from 'react';
import { View, Text } from 'react-native';

export const Marker = (props: any) => null;
export const PROVIDER_DEFAULT = 'default';

const MapView = (props: any) => (
  <View style={[{ backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' }, props.style]}>
    <Text style={{ color: '#64748b' }}>Maps are not supported in Web Preview</Text>
  </View>
);

export default MapView;
