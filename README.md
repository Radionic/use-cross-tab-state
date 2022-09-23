# use-cross-tab-state

A React hook for state synchronization and persistence across multiple browser tabs. The [broadcast-channel
](https://github.com/pubkey/broadcast-channel) is used to dispatch state across tabs.

## Installation

```sh
npm i use-cross-tab-state
# or
yarn add use-cross-tab-state
```

## Usage

```javascript
import { useCrossTabState } from 'use-cross-tab-state';

const App = () => {
  const [counter, setCounter] = useCrossTabState('counter', 1);

  return (
    <button onClick={() => setCounter(counter + 1)}>
      Click counter: {counter}
    </button>
  );
};
```

![Counter](imgs/counter.gif)

```javascript
import { useCrossTabState } from 'use-cross-tab-state';

const App = () => {
  const [news, setNews, { useLeader }] = useCrossTabState('news');

  // useLeader is similar to useEffect: function will re-run when dependencies changed,
  // except it will only run ONCE in the leader tab even if multiple tabs exist.
  useLeader(() => {
    console.log('[Leader] Fetching news...');
    setNews(...);
  }, []);
};
```

## API Reference

### useCrossTabState API

```javascript
const [state, setState, results] = useCrossTabState(key, defaultValue, options);
```

<table>
  <tr>
    <td> Option </td>
    <td> Type </td>
    <td> Default Value </td>
    <td> Description </td>
  </tr>
  <tr>
    <td> storage </td>
    <td> Boolean or Object </td>
    <td> undefined </td>
    <td> 
      The state is persistent in local storage if set to <code>true</code>, or an object: <code>{ onSave: (state) => any, onRead: (state) => any }</code>.
    </td>
  </tr>
  <tr>
    <td> debounce </td>
    <td> Number </td>
    <td> undefined </td>
    <td> 
      Delay state dispatch to other tabs until <code>debounce</code> ms passed after the last call of <code>setState</code>. 
    </td>
  </tr>
  <tr>
    <td> checkLeaderInterval </td>
    <td> Number </td>
    <td> 200 </td>
    <td>
      Check if there exists leader for dispatching initial state to current tab every <code>checkLeaderInterval</code> ms. Checking is stopped when a leader is found.
    </td>
  </tr>
</table>

<table>
  <tr>
    <td> Result </td>
    <td> Type </td>
    <td> Description </td>
  </tr>
  <tr>
    <td> useLeader </td>
    <td> Function </td>
    <td>
      Similar to useEffect: function will re-run when dependencies changed, except it will only run <b>ONCE</b> in the leader tab even if multiple tabs exist.
    </td>
  </tr>
</table>

## Known Issues

- Broadcast channel does not work in Safari private tabs created manually. It works if the private tab is spawned by another private tab.

## Credits

Special thanks to [@kftsehk](https://github.com/kftsehk) for constructive discussion!
