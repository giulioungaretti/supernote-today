/**
 * @format
 */

import {AppRegistry, Image} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {PluginManager} from 'sn-plugin-lib';
import {TODAY_TOOLBAR_BUTTON_ID} from './src/runtime/buttonIds';
import {publishEntryIntent} from './src/runtime/entryState';

AppRegistry.registerComponent(appName, () => App);

const initializePlugin = async () => {
  await PluginManager.init();

  const toolbarRegistered = await PluginManager.registerButton(1, ['NOTE'], {
    id: TODAY_TOOLBAR_BUTTON_ID,
    name: 'Today',
    icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
    showType: 1,
  });
  if (!toolbarRegistered) {
    console.error('Today toolbar registration failed');
  }

  const configRegistered = await PluginManager.registerConfigButton();
  if (!configRegistered) {
    console.error('Today config-button registration failed');
  }

  PluginManager.registerButtonListener({
    onButtonPress(event) {
      if (event.id === TODAY_TOOLBAR_BUTTON_ID) {
        publishEntryIntent('opening');
      }
    },
  });

  PluginManager.registerConfigButtonListener({
    onClick() {
      publishEntryIntent('settings');
      PluginManager.showPluginView()
        .then(shown => {
          if (!shown) {
            console.error('Today settings view did not open');
          }
        })
        .catch(error => {
          console.error('Today settings view failed to open', error);
        });
    },
  });
};

initializePlugin().catch(error => {
  console.error('Today plugin initialization failed', error);
});
