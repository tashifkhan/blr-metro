import type { LinkingOptions } from '@react-navigation/native';

import type { RootTabParamList } from './types';

/**
 * Client-side routes for the web build. Tab switches, pushed pages, and the
 * search query all land in the URL, so pages are shareable and the browser
 * back button works. Native ignores the https prefixes and behaves as before.
 *
 * Detail paths stay unique per tab (`/station/...` under Plan,
 * `/lines/station/...` under Network) so an incoming URL resolves to exactly
 * one stack. Everything not in the path segments (station names, codes left
 * over, departure time) rides along as query params automatically.
 */
export const navigationLinking: LinkingOptions<RootTabParamList> = {
  prefixes: [
    'https://blr-metro.tashif.codes',
    'https://blr-metro.vercel.app',
    'http://localhost:8081',
    'http://localhost:19006',
  ],
  config: {
    screens: {
      HomeTab: {
        path: '',
        screens: {
          Home: '',
          JourneyResults: 'journey/:fromCode/:toCode',
          StationDetail: 'station/:stationCode',
          Settings: 'settings',
          Appearance: { path: 'settings/appearance', alias: ['appearance'] },
          About: 'about',
        },
      },
      MapTab: {
        path: 'map',
        screens: {
          MetroMap: '',
          StationDetail: 'station/:stationCode',
        },
      },
      NetworkTab: {
        path: 'lines',
        initialRouteName: 'Network',
        screens: {
          Network: { path: '', alias: [{ path: 'search', exact: true }] },
          LineStations: ':lineCode',
          StationDetail: {
            path: 'station/:stationCode',
            alias: [{ path: 'search/station/:stationCode', exact: true }],
          },
        },
      },
      SavedTab: {
        path: 'saved',
        initialRouteName: 'Saved',
        screens: {
          Saved: '',
          JourneyResults: 'journey/:fromCode/:toCode',
          StationDetail: 'station/:stationCode',
        },
      },
      AlertsTab: {
        path: 'notifications',
        screens: {
          Notifications: '',
        },
      },
    },
  },
};
