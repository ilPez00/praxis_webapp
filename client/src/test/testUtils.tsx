import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';

interface WrapperOptions {
  route?: string;
}

function createWrapper(options: WrapperOptions = {}) {
  const { route = '/' } = options;

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[route]}>
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          {children}
        </SWRConfig>
      </MemoryRouter>
    );
  };
}

export function renderWithProviders(
  ui: ReactElement,
  options: WrapperOptions & Omit<RenderOptions, 'wrapper'> = {}
) {
  const { route, ...renderOptions } = options;
  return render(ui, { wrapper: createWrapper({ route }), ...renderOptions });
}

export * from '@testing-library/react';
