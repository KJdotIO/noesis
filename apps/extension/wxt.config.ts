import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Noesis',
    description:
      'A Stanford Encyclopedia of Philosophy reading companion for saves, highlights, and resume.',
    permissions: ['activeTab', 'scripting', 'storage'],
    host_permissions: ['https://plato.stanford.edu/entries/*'],
  },
});
