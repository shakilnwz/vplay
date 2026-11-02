//go:build !android

package video

import (
	"fmt"
	"time"
)

// DesktopPlayer is a mock/fallback video player for desktop testing.
type DesktopPlayer struct {
	state          PlaybackState
	position       time.Duration
	duration       time.Duration
	speed          float32
	volume         float32
	width          int
	height         int
	texID          uint32
	transform      [16]float32
	startTime      time.Time
}

// New creates a platform-appropriate video player.
func New(texID uint32) (Player, error) {
	return NewDesktopPlayer(texID)
}

// NewDesktopPlayer creates a fallback player for desktop environments.
func NewDesktopPlayer(texID uint32) (*DesktopPlayer, error) {
	var identity [16]float32
	identity[0] = 1.0
	identity[5] = 1.0
	identity[10] = 1.0
	identity[15] = 1.0

	return &DesktopPlayer{
		state:     StateIdle,
		speed:     1.0,
		volume:    1.0,
		width:     3840,
		height:    2160,
		duration:  10 * time.Minute,
		texID:     texID,
		transform: identity,
	}, nil
}

func (p *DesktopPlayer) OpenURI(uri string) error {
	p.state = StatePlaying
	p.position = 0
	p.startTime = time.Now()
	fmt.Printf("[DesktopPlayer] OpenURI: %s\n", uri)
	return nil
}

func (p *DesktopPlayer) OpenFD(fd uintptr, offset, length int64) error {
	p.state = StatePlaying
	p.position = 0
	p.startTime = time.Now()
	fmt.Printf("[DesktopPlayer] OpenFD: %d (offset: %d, length: %d)\n", fd, offset, length)
	return nil
}

func (p *DesktopPlayer) Release() {
	p.state = StateIdle
}

func (p *DesktopPlayer) Play() error {
	p.state = StatePlaying
	p.startTime = time.Now().Add(-p.position)
	return nil
}

func (p *DesktopPlayer) Pause() error {
	if p.state == StatePlaying {
		p.position = time.Since(p.startTime)
	}
	p.state = StatePaused
	return nil
}

func (p *DesktopPlayer) Seek(pos time.Duration) error {
	p.position = pos
	p.startTime = time.Now().Add(-pos)
	return nil
}

func (p *DesktopPlayer) SetPlaybackSpeed(speed float32) error {
	p.speed = speed
	return nil
}

func (p *DesktopPlayer) SetVolume(volume float32) error {
	p.volume = volume
	return nil
}

func (p *DesktopPlayer) State() PlaybackState {
	return p.state
}

func (p *DesktopPlayer) Position() time.Duration {
	if p.state == StatePlaying {
		return time.Since(p.startTime)
	}
	return p.position
}

func (p *DesktopPlayer) Duration() time.Duration {
	return p.duration
}

func (p *DesktopPlayer) VideoDimensions() (int, int) {
	return p.width, p.height
}

func (p *DesktopPlayer) AudioTracks() []TrackInfo {
	return []TrackInfo{
		{Index: 0, Type: "audio", Language: "eng", Title: "English Stereo", Channels: 2, Selected: true},
	}
}

func (p *DesktopPlayer) SelectAudioTrack(index int) error {
	return nil
}

func (p *DesktopPlayer) SubtitleTracks() []TrackInfo {
	return []TrackInfo{}
}

func (p *DesktopPlayer) SelectSubtitleTrack(index int) error {
	return nil
}

func (p *DesktopPlayer) UpdateTexImage() error {
	// No-op on desktop mock
	return nil
}

func (p *DesktopPlayer) TextureID() uint32 {
	return p.texID
}

func (p *DesktopPlayer) TextureTransform() [16]float32 {
	return p.transform
}
