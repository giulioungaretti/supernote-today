import {supernoteDeviceAdapter} from '../adapters/supernote/supernoteDeviceAdapter';
import {systemClock} from '../ports/clock';
import {createTodayController} from './todayController';

export const todayController = createTodayController({
  device: supernoteDeviceAdapter,
  clock: systemClock,
});
