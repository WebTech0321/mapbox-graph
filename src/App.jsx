import React, { useEffect, useRef, useState } from 'react';

import ReactMapGL from 'react-map-gl';
import mapboxgl from "mapbox-gl";
import { devices as Devices, request as Request, drives as Drives } from '@commaai/api';
import MyCommaAuth, { config as AuthConfig, storage as AuthStorage } from '@commaai/my-comma-auth';
import Switch from './Switch';
import { scaleOrdinal } from "d3";
import { schemeAccent } from "d3-scale-chromatic";

export const MAPBOX_STYLE = 'mapbox://styles/commaai/cjj4yzqk201c52ss60ebmow0w';
export const MAPBOX_TOKEN = 'pk.eyJ1IjoiY29tbWFhaSIsImEiOiJjangyYXV0c20wMGU2NDluMWR4amUydGl5In0.6Vb11S6tdX6Arpj6trRE_g';

export const DEFAULT_LOCATION = {
  latitude: 32.711483,
  longitude: -117.161052,
};

export const COLOR_OPTIONS = Object.freeze({
  NOTHING: 1,
  DEVICE_TYPE: 2,
  CAR_PLATFORM: 3,
  GIT_REMOTE: 4,
  USER: 5,
});

function App() {
  const [viewport ,setViewPort] = useState({
    ...DEFAULT_LOCATION,
    zoom: 4,
  })
  const [segments, setSegments] = useState();
  const [colorOption, setColorOption] = useState(COLOR_OPTIONS.CAR_PLATFORM)
  const mapRef = useRef();
  const markers = useRef({});

  useEffect(() => {
    async function fetchAsync () {
      try {
        AuthStorage.setCommaAccessToken(process.env.REACT_APP_API_TOKEN);
        const _token = await MyCommaAuth.init();
        if (_token) {
          Request.configure(_token);
        }
        const _devices = await Devices.listDevices()

        const promises = [];
        _devices.forEach((device) => {
          const segPromise = Drives.getRoutesSegments(device.dongle_id, new Date("2000-01-01").getTime(), new Date().getTime())
          promises.push(segPromise)
        })
        
        Promise.all(promises).then((values) => {
          const _segments = values.flat();
          setSegments(_segments);
        })
      } catch (e) {
        console.log(e);
      }
    } 
    fetchAsync();
  }, [])

  useEffect(() => {
    if ( !mapRef.current || !segments ) return;
    const map = mapRef.current.getMap();

    if ( !map ) return;

    const coordinates = segments.map((v) => [[v.start_lng, v.start_lat], [v.end_lng, v.end_lat]]).flat();
    const bounds = coordinates.reduce((bounds, coord) => {
      return bounds.extend(coord);
    }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

    map.fitBounds(bounds, { padding: 20, duration: 1000 });
    setTimeout(() => {
      const center = map.getCenter();
      setViewPort({
        longitude: center.lng,
        latitude: center.lat,
        zoom: map.getZoom()
      })
    }, 1500)
  }, [segments])

  useEffect(() => {
    if ( !mapRef.current || !segments ) return;
    const map = mapRef.current.getMap();
    if ( !map ) return;

    updateMarkers();
    
    map.on('render', () => {
      updateMarkers();
    });
  }, [segments, colorOption])
  
  function updateMarkers() {
    const map = mapRef.current.getMap();
    
    const domains = segments.map((v) => {
      if( colorOption === COLOR_OPTIONS.DEVICE_TYPE)
        return v.devicetype
      if( colorOption === COLOR_OPTIONS.CAR_PLATFORM)
        return v.platform
      if( colorOption === COLOR_OPTIONS.GIT_REMOTE)
        return v.git_remote
      if( colorOption === COLOR_OPTIONS.USER)
        return v.user_id
      return 0;
    });
    
    const colors = scaleOrdinal(schemeAccent).domain(domains);
    for (const segment of segments) {
        const coords = [segment.start_lng, segment.start_lat];
        const id = segment.fullname;

        let marker = markers.current[id];
        if (marker)
          marker.remove();
        let color = colors(0);
        if( colorOption === COLOR_OPTIONS.DEVICE_TYPE)
          color = colors(segment.devicetype)
        else if( colorOption === COLOR_OPTIONS.CAR_PLATFORM)
          color = colors(segment.platform)
        else if( colorOption === COLOR_OPTIONS.GIT_REMOTE)
          color = colors(segment.git_remote)
        else if( colorOption === COLOR_OPTIONS.USER)
          color = colors(segment.user_id)
        const el = createArcPath(map, segment, color);
        marker = markers.current[id] = new mapboxgl.Marker({
            element: el
        }).setLngLat(coords);

        marker.addTo(map);
    }
  }

  // code for creating an SVG donut chart from feature properties
  function createArcPath(map, props, color) {
    const startCoord = mapboxgl.MercatorCoordinate.fromLngLat({lng: props.start_lng, lat: props.start_lat}, 0);
    const endCoord = mapboxgl.MercatorCoordinate.fromLngLat({lng: props.end_lng, lat: props.end_lat}, 0);
    let x2 = (endCoord.x - startCoord.x) * Math.pow(2, map.getZoom()) * 512
    let y2 = (endCoord.y - startCoord.y) * Math.pow(2, map.getZoom()) * 512
    let x1 = 0, y1 = 0;
    const w = Math.abs(x2);
    const h = Math.abs(y2);
    let html = `<div>
        <svg width="${w * 2}" height="${h * 2}" viewbox="${-w} ${-h} ${w * 2} ${h * 2}">
          <path d="${arc(x1, y1, x2, y2)}" stroke="${color}" fill="transparent" />
        </svg>
      </div>`;

    const el = document.createElement('div');
    el.innerHTML = html;
    return el.firstChild;
  }
  
  function arc(x1, y1, x2, y2) {
    const r = Math.hypot(x1 - x2, y1 - y2) * 2;
    return `M${x1},${y1} A${r},${r} 0,0,1 ${x2},${y2}`;
  }

  return (
    <div className="relative w-screen h-screen">
      <ReactMapGL
        width="100%"
        height="100%"
        mapboxApiAccessToken={MAPBOX_TOKEN}
        mapStyle={MAPBOX_STYLE}
        latitude={viewport.latitude}
        longitude={viewport.longitude}
        zoom={viewport.zoom}
        ref={mapRef}
        onViewportChange={setViewPort}
      >
      </ReactMapGL>

      <div className='absolute top-4 right-4 bg-white/20 text-white p-4 rounded'>
        <div className='mb-4'>Color Routes by</div>
        <div className='flex flex-col gap-3'>
          <div className='flex items-center gap-3'>
            <Switch checked={colorOption === COLOR_OPTIONS.NOTHING} onToggle={() => setColorOption(COLOR_OPTIONS.NOTHING)} />
            <div>Nothing</div>
          </div>
          <div className='flex items-center gap-3'>
            <Switch checked={colorOption === COLOR_OPTIONS.DEVICE_TYPE} onToggle={() => setColorOption(COLOR_OPTIONS.DEVICE_TYPE)} />
            <div>Device Type</div>
          </div>
          <div className='flex items-center gap-3'>
            <Switch checked={colorOption === COLOR_OPTIONS.CAR_PLATFORM} onToggle={() => setColorOption(COLOR_OPTIONS.CAR_PLATFORM)} />
            <div>Car Platform</div>
          </div>
          <div className='flex items-center gap-3'>
            <Switch checked={colorOption === COLOR_OPTIONS.GIT_REMOTE} onToggle={() => setColorOption(COLOR_OPTIONS.GIT_REMOTE)} />
            <div>Git Remote</div>
          </div>
          <div className='flex items-center gap-3'>
            <Switch checked={colorOption === COLOR_OPTIONS.USER} onToggle={() => setColorOption(COLOR_OPTIONS.USER)} />
            <div>User</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
