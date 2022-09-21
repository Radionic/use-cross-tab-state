import { useCallback, useEffect, useRef, useState } from 'react';
import { BroadcastChannel, createLeaderElection } from 'broadcast-channel';

const useCrossTabState = (key, initValue, options = {}) => {
  const { storage, debounce, checkLeaderInterval = 200 } = options;
  const [state, setState] = useState(initValue);
  const [channel, setChannel] = useState();
  const [inited, setInited] = useState();
  const [isLeader, setIsLeader] = useState();
  const timeoutId = useRef();

  const dispatchState = useCallback(
    newState => {
      setState(newState);
      if (channel) {
        if (debounce > 0) {
          window.clearTimeout(timeoutId.current);
          timeoutId.current = window.setTimeout(() => {
            channel.postMessage(newState);
          }, debounce);
        } else {
          channel.postMessage(newState);
        }
      }
    },
    [channel, debounce, setState]
  );

  useEffect(() => {
    // Create broadcast channel and await for leadership
    const newChannel = new BroadcastChannel(key);
    setChannel(newChannel);
    const elector = createLeaderElection(newChannel);
    elector.awaitLeadership().then(() => {
      setIsLeader(true);
    });

    // Wait leader to be elected before asking leader for init value
    const checkHasLeader = setInterval(() => {
      if (elector.hasLeader) {
        clearInterval(checkHasLeader);
        if (elector.isLeader) {
          if (storage) {
            // Retrieve init value from local storage (if any)
            if (localStorage[key]) {
              let initState = JSON.parse(localStorage[key]).data;
              if (typeof storage['onRead'] === 'function') {
                initState = storage['onRead'](initState);
              }
              setState(initState);
            }
            setInited(true);
          } else if (!inited) {
            // Retrieve init value from non-leader tab (if any)
            // TODO: more efficient way to retrieve init value for leader tab without storage?
            newChannel.postMessage({ type: 'ASK_INIT_VALUE', force: true });
          }
        } else {
          // Retrieve init value from leader tab
          newChannel.postMessage({ type: 'ASK_INIT_VALUE' });
        }
      }
    }, checkLeaderInterval);

    return () => newChannel.close();
  }, []);

  useEffect(() => {
    if (!channel) {
      return;
    }
    channel.onmessage = message => {
      // Leader returns state if requesed by other tabs
      if (message?.type === 'ASK_INIT_VALUE') {
        if (isLeader || message.force) {
          channel.postMessage({ type: 'RETURN_INIT_VALUE', state });
        }
        return;
      }

      // Set state when received broadcast message
      if (message?.type === 'RETURN_INIT_VALUE') {
        if (inited) {
          return;
        }
        setInited(true);
        message = message.state;
      }
      setState(message);
    };
  }, [channel, state, inited, isLeader, setState]);

  // Leader writes to local storage when state is changed
  useEffect(() => {
    if (isLeader && inited && storage) {
      let saveValue = state;
      if (typeof storage['onSave'] === 'function') {
        saveValue = storage['onSave'](saveValue);
      }
      localStorage[key] = JSON.stringify({ data: saveValue });
    }
  }, [state, inited, isLeader, storage]);

  const useLeader = (effect, deps) =>
    useEffect(() => {
      if (isLeader) {
        effect();
      }
    }, [isLeader, ...deps]);

  return [state, dispatchState, { useLeader }];
};

export default useCrossTabState;
