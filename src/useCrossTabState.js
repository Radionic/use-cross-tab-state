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
      if (message?.type === 'ASK_INIT_VALUE') {
        if (isLeader) {
          channel.postMessage({ type: 'RETURN_INIT_VALUE', state });
        }
        return;
      }

      // Set state when received broadcast message
      if (message?.type === 'RETURN_INIT_VALUE') {
        setInited(true);
        message = message.state;
      }
      setState(message);
    };
  }, [channel, state, isLeader, setState]);

  // Ask leader for initial value
  useEffect(() => {
    if (channel && !inited) {
      channel.postMessage({ type: 'ASK_INIT_VALUE' });
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
      let initState;
      if (storage) {
        initState = JSON.parse(localStorage[key]).data;
        if (typeof storage['onRead'] === 'function') {
          initState = storage['onRead'](initState);
        }
      } else if (sessionStorage.getItem(key) && !inited) {
        // leader -> leader due to tab refresh, then read from session storage
        initState = JSON.parse(sessionStorage.getItem(key)).data;
      } else {
        // non-leader -> leader due to leader death, then broadcast its state
        initState = state;
      }

      if (!inited) {
        setState(initState);
      }
      channel.postMessage({ type: 'RETURN_INIT_VALUE', state: initState });
      setInited(true);
    }
  }, [isLeader, state, channel, storage, setState, setInited]);

  const useLeader = (effect, deps) =>
    useEffect(() => {
      if (isLeader) {
        effect();
      }
    }, [isLeader, ...deps]);

  return { state, setState: dispatchState, useLeader };
};

export default useCrossTabState;
