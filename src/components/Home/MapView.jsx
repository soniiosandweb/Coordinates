import React from 'react';
import { GoogleMap } from '@react-google-maps/api';

const MapView = ({ defaultCenter, onLoad, setMap }) => {
  return (
    <GoogleMap center={defaultCenter} zoom={8} mapContainerStyle={{ width: '100%', height: '100%' }} onLoad={onLoad} onUnmount={() => setMap(null)} />
  );
};

export default MapView;
