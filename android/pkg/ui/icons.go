package ui

import (
	"gioui.org/widget"
	"golang.org/x/exp/shiny/materialdesign/icons"
)

// IconManager holds all parsed Material Design IconVG icons for the application.
type IconManager struct {
	Play           *widget.Icon
	Pause          *widget.Icon
	Replay10       *widget.Icon
	Forward10      *widget.Icon
	Fullscreen     *widget.Icon
	FullscreenExit *widget.Icon
	Menu           *widget.Icon
	Close          *widget.Icon
	ExpandMore     *widget.Icon
	ExpandLess     *widget.Icon
	Folder         *widget.Icon
	FolderOpen     *widget.Icon
	Lock           *widget.Icon
	LockOpen       *widget.Icon
	VolumeUp       *widget.Icon
	VolumeOff      *widget.Icon
	Recenter       *widget.Icon
	VRMode         *widget.Icon
	FlatMode       *widget.Icon
	EyeSwap        *widget.Icon
	Check          *widget.Icon
}

// AppIcons is the shared singleton of Material Design icons.
var AppIcons = newIconManager()

func mustIcon(ic *widget.Icon, err error) *widget.Icon {
	if err != nil {
		panic(err)
	}
	return ic
}

func newIconManager() *IconManager {
	return &IconManager{
		Play:           mustIcon(widget.NewIcon(icons.AVPlayArrow)),
		Pause:          mustIcon(widget.NewIcon(icons.AVPause)),
		Replay10:       mustIcon(widget.NewIcon(icons.AVReplay10)),
		Forward10:      mustIcon(widget.NewIcon(icons.AVForward10)),
		Fullscreen:     mustIcon(widget.NewIcon(icons.NavigationFullscreen)),
		FullscreenExit: mustIcon(widget.NewIcon(icons.NavigationFullscreenExit)),
		Menu:           mustIcon(widget.NewIcon(icons.NavigationMenu)),
		Close:          mustIcon(widget.NewIcon(icons.NavigationClose)),
		ExpandMore:     mustIcon(widget.NewIcon(icons.NavigationExpandMore)),
		ExpandLess:     mustIcon(widget.NewIcon(icons.NavigationExpandLess)),
		Folder:         mustIcon(widget.NewIcon(icons.FileFolder)),
		FolderOpen:     mustIcon(widget.NewIcon(icons.FileFolderOpen)),
		Lock:           mustIcon(widget.NewIcon(icons.ActionLock)),
		LockOpen:       mustIcon(widget.NewIcon(icons.ActionLockOpen)),
		VolumeUp:       mustIcon(widget.NewIcon(icons.AVVolumeUp)),
		VolumeOff:      mustIcon(widget.NewIcon(icons.AVVolumeOff)),
		Recenter:       mustIcon(widget.NewIcon(icons.ActionTrackChanges)),
		VRMode:         mustIcon(widget.NewIcon(icons.Action3DRotation)),
		FlatMode:       mustIcon(widget.NewIcon(icons.ImagePanoramaFishEye)),
		EyeSwap:        mustIcon(widget.NewIcon(icons.ImageCropRotate)),
		Check:          mustIcon(widget.NewIcon(icons.ActionDone)),
	}
}
