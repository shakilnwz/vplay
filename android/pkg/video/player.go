package video

import (
	"time"
)

// PlaybackState represents the current state of the media player.
type PlaybackState int

const (
	StateIdle PlaybackState = iota
	StateBuffering
	StatePlaying
	StatePaused
	StateEnded
	StateError
)

func (s PlaybackState) String() string {
	switch s {
	case StateIdle:
		return "Idle"
	case StateBuffering:
		return "Buffering"
	case StatePlaying:
		return "Playing"
	case StatePaused:
		return "Paused"
	case StateEnded:
		return "Ended"
	case StateError:
		return "Error"
	default:
		return "Unknown"
	}
}

// TrackInfo represents an audio or subtitle stream.
type TrackInfo struct {
	Index    int    `json:"index"`
	Type     string `json:"type"` // "audio" or "subtitle"
	Language string `json:"language"`
	Title    string `json:"title"`
	Channels int    `json:"channels"`
	Selected bool   `json:"selected"`
}

// Player defines the cross-platform hardware video player interface.
type Player interface {
	// DataSource loading
	OpenURI(uri string) error
	OpenFD(fd uintptr, offset, length int64) error
	Release()

	// Playback transport
	Play() error
	Pause() error
	Seek(position time.Duration) error
	SetPlaybackSpeed(speed float32) error
	SetVolume(volume float32) error // 0.0 - 2.0 (with boost)

	// State queries
	State() PlaybackState
	Position() time.Duration
	Duration() time.Duration
	VideoDimensions() (width, height int)

	// Tracks
	AudioTracks() []TrackInfo
	SelectAudioTrack(index int) error
	SubtitleTracks() []TrackInfo
	SelectSubtitleTrack(index int) error

	// GLES Texture Hook
	// UpdateTexImage binds the newest decoded video frame to the OES external texture ID.
	UpdateTexImage() error
	TextureID() uint32
	TextureTransform() [16]float32
}
