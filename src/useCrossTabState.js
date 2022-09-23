import { useCallback, useEffect, useRef, useState } from 'react';
import { BroadcastChannel, createLeaderElection } from 'broadcast-channel';

const useCrossTabState = (key, initValue, options = {}) => {
  const { storage, debounce, checkLeaderInterval = 200 } = options;
  const [state, setState] = useState(initValue);
  const channel = useRef();
  const isLeader = useRef();
  const timeoutId = useRef();

  const dispatchState = useCallback(
    newState => {
      setState(newState);
      if (channel.current) {
        if (debounce > 0) {
          window.clearTimeout(timeoutId.current);
          timeoutId.current = window.setTimeout(() => {
            channel.current.postMessage(newState);
          }, debounce);
        } else {
          channel.current.postMessage(newState);
        }
      }
    },
    [debounce]
  );

  useEffect(() => {
    // Create broadcast channel and await for leadership
    channel.current = new BroadcastChannel(key);
    const elector = createLeaderElection(channel.current);
    elector.awaitLeadership().then(() => {
      isLeader.current = true;
    });

    if (storage) {
      // Retrieve init value from local storage (if any)
      if (localStorage[key]) {
        let initState = JSON.parse(localStorage[key]).data;
        if (typeof storage['onRead'] === 'function') {
          initState = storage['onRead'](initState);
        }
        setState(initState);
      }
    } else {
      // Wait leader to be elected before asking leader for init value
      const checkHasLeader = setInterval(() => {
        if (elector.hasLeader) {
          clearInterval(checkHasLeader);
          if (elector.isLeader) {
            // Retrieve init value from non-leader tab (if any)
            // TODO: more efficient way to retrieve init value for leader tab without storage?
            channel.current.postMessage({
              type: 'ASK_INIT_VALUE',
              force: true,
            });
          } else {
            // Retrieve init value from leader tab
            channel.current.postMessage({ type: 'ASK_INIT_VALUE' });
          }
        }
      }, checkLeaderInterval);
    }

    return channel.current.close;
  }, []);

  useEffect(() => {
    if (!channel.current) {
      return;
    }
    channel.current.onmessage = message => {
      // Leader returns state if requesed by other tabs
      if (message?.type === 'ASK_INIT_VALUE') {
        if (isLeader.current || message.force) {
          channel.current.postMessage({ type: 'RETURN_INIT_VALUE', state });
        }
        return;
      }

      // Set state when received broadcast message
      if (message?.type === 'RETURN_INIT_VALUE') {
        message = message.state;
      }
      setState(message);
    };
  }, [state]);

  // Leader writes to local storage when state is changed
  useEffect(() => {
    if (isLeader.current && storage) {
      let saveValue = state;
      if (typeof storage['onSave'] === 'function') {
        saveValue = storage['onSave'](saveValue);
      }
      localStorage[key] = JSON.stringify({ data: saveValue });
    }
  }, [state, storage]);

  const useLeader = (effect, deps) =>
    useEffect(() => {
      if (isLeader.current) {
        effect();
      }
    }, deps);

  return [state, dispatchState, { useLeader }];
};

export default useCrossTabState;
