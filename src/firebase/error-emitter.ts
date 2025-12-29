// /src/firebase/error-emitter.ts
import { EventEmitter } from 'events';

// This is a simple event emitter that can be used to broadcast events across the application.
// We are using it here to broadcast Firestore permission errors.
export const errorEmitter = new EventEmitter();
