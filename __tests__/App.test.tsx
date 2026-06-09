import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
  ScreenStack: ({ children }: any) => children,
  Screen: ({ children }: any) => children,
}));
jest.useFakeTimers();

import App from '../App';

it('renders the navigation root to the Welcome screen', () => {
  let tree: any;
  ReactTestRenderer.act(() => { tree = ReactTestRenderer.create(<App />); });
  expect(tree).toBeTruthy();
  ReactTestRenderer.act(() => { jest.clearAllTimers(); });
});
