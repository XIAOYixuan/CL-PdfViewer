import { useEffect, useState } from 'react';
import eventEmitter from './eventEmitter';

export default function loadUserMajor() {
  const [userMajor, setUserMajor] = useState(null);

  const getUserMajor = () => {
    const userMajor = JSON.parse(localStorage.getItem('settings') as string)?.major|| null;
    setUserMajor(userMajor);
  };

  useEffect(() => {
    getUserMajor();

    eventEmitter.on('refreshSettings', getUserMajor);
    return () => {
      eventEmitter.off('refreshSettings', getUserMajor);
    };
  }, []);

  return userMajor;
}
