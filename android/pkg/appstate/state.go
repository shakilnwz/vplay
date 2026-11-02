package appstate

import (
	"sync"
	"time"
)

// ViewMode represents the 3D projection mode.
type ViewMode string

const (
	ViewMode360    ViewMode = "360"
	ViewMode180    ViewMode = "180"
	ViewModeFlat   ViewMode = "flat"
	ViewModeCurved ViewMode = "curved"
)

// StereoMode represents the stereoscopic 3D decoding format.
type StereoMode string

const (
	StereoNone       StereoMode = "none"
	StereoHorizontal StereoMode = "horizontal" // Left/Right SBS
	StereoVertical   StereoMode = "vertical"   // Top/Bottom
)

// VideoItem represents an indexed video file.
type VideoItem struct {
	URI          string        `json:"uri"`
	Title        string        `json:"title"`
	Path         string        `json:"path"`
	Size         int64         `json:"size"`
	Duration     time.Duration `json:"duration"`
	Width        int           `json:"width"`
	Height       int           `json:"height"`
	LastModified time.Time     `json:"last_modified"`
	LastPosition time.Duration `json:"last_position"`
	IsWatched    bool          `json:"is_watched"`
}

// AspectRatioMode represents the 2D aspect ratio scaling mode.
type AspectRatioMode string

const (
	AspectFit     AspectRatioMode = "fit"
	AspectStretch AspectRatioMode = "stretch"
	AspectCrop    AspectRatioMode = "crop"
	Aspect100     AspectRatioMode = "100"
)

// PlayerMode represents VR panoramic mode vs Portrait flat mode.
type PlayerMode string

const (
	PlayerModeVR       PlayerMode = "vr"
	PlayerModePortrait PlayerMode = "portrait"
)

// AppState holds the global player state across UI, rendering, and media threads.
type AppState struct {
	mu sync.RWMutex

	// Video playback state
	CurrentVideo   *VideoItem
	IsPlaying      bool
	Position       time.Duration
	Duration       time.Duration
	Buffered       time.Duration
	PlaybackSpeed  float32
	Volume         float32 // 0.0 to 1.0 (standard) to 2.0 (boost)
	Brightness     float32 // 0.0 to 1.0
	IsMuted        bool
	DecoderType    string // "HW" or "SW"
	AspectRatio    AspectRatioMode
	PlayerMode     PlayerMode // "vr" or "portrait"

	// 3D / VR state
	ViewMode     ViewMode
	StereoMode   StereoMode
	InvertStereo bool
	GyroEnabled  bool
	CameraFOV    float32 // 45.0 to 110.0 degrees
	Yaw          float32 // Horizontal rotation in radians
	Pitch        float32 // Vertical rotation in radians

	// UI and Gesture State
	ControlsVisible  bool
	ControlsExpanded bool // Accordion tools strip expanded/collapsed
	LastUserAction   time.Time
	IsLocked         bool // Screen Lock
	FolderDrawerOpen bool

	// Gesture HUD states
	ShowBrightnessHUD bool
	ShowVolumeHUD     bool
	ShowSeekHUD       bool
	SeekDeltaSeconds  float64
}

// New returns a newly initialized AppState with sensible defaults.
func New() *AppState {
	return &AppState{
		PlaybackSpeed:   1.0,
		Volume:          1.0,
		Brightness:      0.75,
		DecoderType:      "HW",
		AspectRatio:      AspectFit,
		PlayerMode:       PlayerModeVR,
		ViewMode:         ViewMode360,
		StereoMode:       StereoHorizontal,
		InvertStereo:     false,
		GyroEnabled:      true,
		CameraFOV:        75.0,
		ControlsVisible:  true,
		ControlsExpanded: true,
		LastUserAction:   time.Now(),
	}
}

// TouchActivity marks that user interacted with the UI, resetting auto-hide timer.
func (s *AppState) TouchActivity() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.LastUserAction = time.Now()
	if !s.IsLocked {
		s.ControlsVisible = true
	}
}

// TogglePlayPause flips playback state.
func (s *AppState) TogglePlayPause() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.IsPlaying = !s.IsPlaying
	s.LastUserAction = time.Now()
}

// SetLocked toggles the MX screen lock.
func (s *AppState) SetLocked(locked bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.IsLocked = locked
	s.LastUserAction = time.Now()
	if locked {
		s.ControlsVisible = false
	}
}
