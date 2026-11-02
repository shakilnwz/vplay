//go:build android

package sensor

/*
#cgo LDFLAGS: -landroid -lm

#include <android/sensor.h>
#include <android/looper.h>
#include <stdlib.h>
#include <stdbool.h>
#include <math.h>

typedef struct {
    ASensorManager* sm;
    const ASensor* sensor;
    ASensorEventQueue* queue;
    ALooper* looper;
    bool running;
} SensorContext;

static SensorContext* initSensor() {
    ALooper* looper = ALooper_prepare(ALOOPER_PREPARE_ALLOW_NON_CALLBACKS);
    if (!looper) {
        return NULL;
    }

    ASensorManager* sm = ASensorManager_getInstance();
    if (!sm) {
        return NULL;
    }

    const ASensor* sensor = ASensorManager_getDefaultSensor(sm, ASENSOR_TYPE_ROTATION_VECTOR);
    if (!sensor) {
        return NULL;
    }

    ASensorEventQueue* queue = ASensorManager_createEventQueue(sm, looper, 1, NULL, NULL);
    if (!queue) {
        return NULL;
    }

    ASensorEventQueue_enableSensor(queue, sensor);
    ASensorEventQueue_setEventRate(queue, sensor, 10000); // 10000 microseconds = 100 Hz

    SensorContext* ctx = (SensorContext*)malloc(sizeof(SensorContext));
    ctx->sm = sm;
    ctx->sensor = sensor;
    ctx->queue = queue;
    ctx->looper = looper;
    ctx->running = true;
    return ctx;
}

static bool pollSensorEvent(SensorContext* ctx, float* outQuat) {
    if (!ctx || !ctx->running) return false;

    // Poll looper with 0 timeout (non-blocking)
    int ident = ALooper_pollOnce(0, NULL, NULL, NULL);
    if (ident == 1) {
        ASensorEvent event;
        while (ASensorEventQueue_getEvents(ctx->queue, &event, 1) > 0) {
            if (event.type == ASENSOR_TYPE_ROTATION_VECTOR) {
                // event.data[0..3] = x, y, z, (optional w)
                outQuat[0] = event.data[0];
                outQuat[1] = event.data[1];
                outQuat[2] = event.data[2];
                if (event.data[3] != 0.0f) {
                    outQuat[3] = event.data[3];
                } else {
                    float cosVal = 1.0f - (outQuat[0]*outQuat[0] + outQuat[1]*outQuat[1] + outQuat[2]*outQuat[2]);
                    outQuat[3] = cosVal > 0.0f ? sqrtf(cosVal) : 0.0f;
                }
                return true;
            }
        }
    }
    return false;
}

static void stopSensor(SensorContext* ctx) {
    if (!ctx) return;
    ctx->running = false;
    if (ctx->queue && ctx->sensor) {
        ASensorEventQueue_disableSensor(ctx->queue, ctx->sensor);
        ASensorManager_destroyEventQueue(ctx->sm, ctx->queue);
    }
    free(ctx);
}
*/
import "C"

import (
	"runtime"
	"sync"
	"time"
)

// SensorListener polls the hardware rotation vector sensor on Android via NDK.
type SensorListener struct {
	mu      sync.Mutex
	tracker *Tracker
	stopCh  chan struct{}
}

// NewSensorListener creates an initialized listener attached to a tracker.
func NewSensorListener(tracker *Tracker) *SensorListener {
	return &SensorListener{
		tracker: tracker,
	}
}

// Start spawns a high-priority 100Hz background polling goroutine.
func (s *SensorListener) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stopCh = make(chan struct{})

	go func() {
		// Android ALooper requires thread-affinity for polling
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()

		ctx := C.initSensor()
		if ctx == nil {
			return
		}
		defer C.stopSensor(ctx)

		ticker := time.NewTicker(10 * time.Millisecond) // 100 Hz
		defer ticker.Stop()

		var quat [4]C.float

		for {
			select {
			case <-s.stopCh:
				return
			case <-ticker.C:
				if bool(C.pollSensorEvent(ctx, &quat[0])) {
					s.tracker.UpdateRawSensor(float32(quat[0]), float32(quat[1]), float32(quat[2]), float32(quat[3]))
				}
			}
		}
	}()

	return nil
}

// Stop terminates the polling thread and releases sensor queues.
func (s *SensorListener) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.stopCh != nil {
		close(s.stopCh)
		s.stopCh = nil
	}
}
