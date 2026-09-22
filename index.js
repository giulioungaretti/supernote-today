/**
 * @format
 */

import {AppRegistry, Image} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {PluginManager} from 'sn-plugin-lib';
import {TODAY_TOOLBAR_BUTTON_ID} from './src/runtime/buttonIds';
import {todayController} from './src/runtime/pluginRuntime';

AppRegistry.registerComponent(appName, () => App);

const initializePlugin = async () => {
  await PluginManager.init();

  const toolbarRegistered = await PluginManager.registerButton(1, ['NOTE'], {
    id: TODAY_TOOLBAR_BUTTON_ID,
    name: 'Today',
    icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
    showType: 0,
  });
  if (!toolbarRegistered) {
    throw new Error(
      'Today toolbar registration failed. Check Plugin Preview firmware.',
    );
  }

  const configRegistered = await PluginManager.registerConfigButton();
  if (!configRegistered) {
    throw new Error(
      'Today config-button registration failed. Check Plugin Preview firmware.',
    );
  }

  PluginManager.registerButtonListener({
    onButtonPress(event) {
      if (event.id === TODAY_TOOLBAR_BUTTON_ID) {
        todayController.openToday();
      }
    },
  });

  PluginManager.registerConfigButtonListener({
    onClick() {
      todayController.showSettings();
    },
  });
};

initializePlugin().catch(todayController.failInitialization);
