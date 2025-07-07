Change the stuff to the new C:\Users\Givano\Desktop\ShooterX-v1.2.0\resources\app\three.js-r178
# Three.js Migration Guide from older version to r178

## File Structure Changes
1. Update the path references to point to the new location:
   ```
   C:\Users\Givano\Desktop\ShooterX-v1.2.0\resources\app\three.js-r178
   ```

## ES Modules Migration

### 1. Change script imports
Replace old script tags:

```javascript
const THREE = require('three');
```

With new path:
```javascript
const THREE = require('../three.js-r178/three.js-r178/src/Three.js');
```

### 2. ES Modules (Future Enhancement)
For future updates, consider migrating to ES modules:
```javascript
import * as THREE from '../three.js-r178/three.js-r178/src/Three.js';
```

## Files Updated
The following files were updated to use the new Three.js path:
- src/enemy.js
- src/game.js
- src/player.js
- src/environment.js
- src/weapon.js
- src/wave.js
- src/powerup.js
- src/enemyManager.js
- src/enemy_manager.js
- src/enemyTypes.js

