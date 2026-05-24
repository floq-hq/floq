import { ThemeProvider } from './theme';
import { ComponentsPreview } from './components/dev/ComponentsPreview';

// Until Expo Router lands (S2.2), the app entry renders the dev kitchen sink for
// the UI primitives (S1.3). `ComponentsPreview` is itself dev-only; in a release
// build this would render the real root instead.
export default function App() {
  return (
    <ThemeProvider>
      <ComponentsPreview />
    </ThemeProvider>
  );
}
