import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'electron',
    {
        ipcRenderer: {
            send: (channel, data) => {
                // whitelist channels
                const validChannels = ['quit-game'];
                if (validChannels.includes(channel)) {
                    ipcRenderer.send(channel, data);
                }
            }
        }
    }
); 