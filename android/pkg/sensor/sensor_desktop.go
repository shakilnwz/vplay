//go:build !android

package sensor

// SensorListener is a desktop mock for the hardware rotation vector sensor.
type SensorListener struct {
	tracker *Tracker
	running bool
}

// NewSensorListener creates a mock sensor listener.
func NewSensorListener(tracker *Tracker) *SensorListener {
	return &SensorListener{
		tracker: tracker,
	}
}

// Start initiates sensor polling.
func (s *SensorListener) Start() error {
	s.running = true
	return nil
}

// Stop terminates sensor polling.
func (s *SensorListener) Stop() {
	s.running = false
}
