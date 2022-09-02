import { useCallback, useEffect, useState } from 'react';
import { BroadcastChannel, createLeaderElection } from 'broadcast-channel';

const useCrossTabState = (key, initValue, options = {}) => {
  const { storage } = options;
  const [state, setState] = useState(initValue);
  const [channel, setChannel] = useState();
  const [inited, setInited] = useState();
  const [isLeader, setIsLeader] = useState();

  const dispatchState = useCallback(
    newState => {
      if (channel) {
        setState(newState);
        channel.postMessage(newState);
      }
    },
    [channel, setState]
  );

  // Create broadcast channel and await for leadership
  useEffect(() => {
    const newChannel = new BroadcastChannel(key);
    setChannel(newChannel);
    const elector = createLeaderElection(newChannel);
    elector.awaitLeadership().then(() => {
      document.title = `isLeader ${key}`;
      setIsLeader(true);
    });
    return () => newChannel.close();
  }, []);

  useEffect(() => {
    if (!channel) {
      return;
    }
    channel.onmessage = message => {
      // Leader returns state if requesed by other tabs
      if (message.type === 'ASK_FOR_VALUE') {
        if (isLeader) {
          channel.postMessage({ type: 'RETURN_VALUE', state });
        }
        return;
      }

      // Set state when received broadcast message
      if (message.type === 'RETURN_VALUE') {
        setInited(true);
        message = message.state;
      }
      setState(message);
    };
  }, [channel, state, isLeader, setState]);

  // Ask leader for initial value
  useEffect(() => {
    if (channel && !inited) {
      channel.postMessage({ type: 'ASK_FOR_VALUE' });
    }
  }, [channel, inited]);

  // Leader writes to local or session storage when state is changed
  useEffect(() => {
    if (isLeader && inited) {
      if (storage) {
        let saveValue = state;
        if (typeof storage['onSave'] === 'function') {
          saveValue = storage['onSave'](saveValue);
        }
        localStorage[key] = JSON.stringify({ data: saveValue });
      } else {
        // Save state to session to avoid state lost due to leadership remains after tab refreshed
        sessionStorage[key] = JSON.stringify({ data: state });
      }
    }
  }, [state, inited, isLeader, storage]);

  // When become a leader, read state from local or session or React.useState
  // then broadcast the state (to avoid the issue that leader tab A refreshed and isn't leader anymore, then tab A asks for init value, but no leader is elected yet)
  useEffect(() => {
    if (isLeader && channel) {
      setInited(true);

      if (storage) {
        let initState = JSON.parse(localStorage[key]).data;
        if (typeof storage['onRead'] === 'function') {
          initState = storage['onRead'](initState);
        }
        dispatchState(initState);
      } else if (sessionStorage.getItem(key)) {
        dispatchState(JSON.parse(sessionStorage.getItem(key)).data);
      } else {
        channel.postMessage(state);
      }
    }
  }, [isLeader, state, channel, storage, dispatchState]);

  const useLeader = (effect, deps) =>
    useEffect(() => {
      if (isLeader) {
        effect();
      }
    }, [isLeader, ...deps]);

  return { state, setState: dispatchState, useLeader };
};

export default useCrossTabState;
