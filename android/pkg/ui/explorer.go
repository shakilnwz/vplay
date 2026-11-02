package ui

import (
	"fmt"
	"image"
	"time"

	"gioui.org/layout"
	"gioui.org/op/clip"
	"gioui.org/op/paint"
	"gioui.org/unit"
	"gioui.org/widget"
	"gioui.org/widget/material"
	"github.com/shakilnwz/vplay/android/pkg/appstate"
	"github.com/shakilnwz/vplay/android/pkg/storage"
)

// Explorer manages the MX Player folder-first library and media browser.
type Explorer struct {
	folderList widget.List
	videoList  widget.List

	// Navigation state
	currentFolder string // empty = top-level folder view
	videos        []appstate.VideoItem
	folders       map[string][]appstate.VideoItem

	// Search & Sorting
	searchEditor widget.Editor
	sortOrder    storage.SortOrder
	btnSort      widget.Clickable
	btnClose     widget.Clickable
	btnBackFolder widget.Clickable

	// Resume prompt modal
	resumePendingVideo *appstate.VideoItem
	btnResume          widget.Clickable
	btnStartOver       widget.Clickable

	// Clickables for items
	folderClicks []widget.Clickable
	videoClicks  []widget.Clickable

	OnSelectVideo func(video appstate.VideoItem, startFrom time.Duration)
	OnClose       func()
}

// NewExplorer creates an initialized media explorer.
func NewExplorer() *Explorer {
	return &Explorer{
		folderList: widget.List{
			List: layout.List{Axis: layout.Vertical},
		},
		videoList: widget.List{
			List: layout.List{Axis: layout.Vertical},
		},
		sortOrder: storage.SortDateNewest,
		folders:   make(map[string][]appstate.VideoItem),
	}
}

// SetVideos loads indexed video files into the explorer.
func (ex *Explorer) SetVideos(videos []appstate.VideoItem) {
	ex.videos = videos
	ex.folders = storage.GroupVideosByFolder(videos)
	ex.folderClicks = make([]widget.Clickable, len(ex.folders))
}

// Layout renders the explorer drawer / modal view.
func (ex *Explorer) Layout(gtx layout.Context, th *material.Theme, state *appstate.AppState) layout.Dimensions {
	ex.handleEvents(gtx)

	// Background scrim
	paint.Fill(gtx.Ops, ColorBackground)

	return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
		// Header Bar
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			return ex.layoutHeader(gtx, th)
		}),
		// Content Area (Folder-First View or Video List)
		layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
			if ex.currentFolder == "" {
				return ex.layoutFolderList(gtx, th)
			}
			return ex.layoutVideoList(gtx, th)
		}),
		// Resume Dialog Overlay (if pending)
		layout.Rigid(func(gtx layout.Context) layout.Dimensions {
			if ex.resumePendingVideo != nil {
				return ex.layoutResumeDialog(gtx, th)
			}
			return layout.Dimensions{}
		}),
	)
}

func (ex *Explorer) handleEvents(gtx layout.Context) {
	if ex.btnClose.Clicked(gtx) {
		if ex.OnClose != nil {
			ex.OnClose()
		}
	}
	if ex.btnBackFolder.Clicked(gtx) {
		ex.currentFolder = ""
	}
	if ex.btnSort.Clicked(gtx) {
		switch ex.sortOrder {
		case storage.SortDateNewest:
			ex.sortOrder = storage.SortNameAsc
		case storage.SortNameAsc:
			ex.sortOrder = storage.SortDurationMax
		case storage.SortDurationMax:
			ex.sortOrder = storage.SortSizeMax
		default:
			ex.sortOrder = storage.SortDateNewest
		}
	}

	// Handle Resume Dialog
	if ex.resumePendingVideo != nil {
		if ex.btnResume.Clicked(gtx) {
			video := *ex.resumePendingVideo
			pos := video.LastPosition
			ex.resumePendingVideo = nil
			if ex.OnSelectVideo != nil {
				ex.OnSelectVideo(video, pos)
			}
		}
		if ex.btnStartOver.Clicked(gtx) {
			video := *ex.resumePendingVideo
			ex.resumePendingVideo = nil
			if ex.OnSelectVideo != nil {
				ex.OnSelectVideo(video, 0)
			}
		}
	}
}

func (ex *Explorer) layoutHeader(gtx layout.Context, th *material.Theme) layout.Dimensions {
	return layout.Background{}.Layout(gtx,
		func(gtx layout.Context) layout.Dimensions {
			defer clip.Rect{Max: gtx.Constraints.Max}.Push(gtx.Ops).Pop()
			paint.Fill(gtx.Ops, ColorSurface)
			return layout.Dimensions{Size: gtx.Constraints.Max}
		},
		func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{
				Top:    unit.Dp(12),
				Bottom: unit.Dp(12),
				Left:   unit.Dp(16),
				Right:  unit.Dp(16),
			}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				return layout.Flex{Axis: layout.Horizontal, Alignment: layout.Middle}.Layout(gtx,
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						if ex.currentFolder != "" {
							return material.Clickable(gtx, &ex.btnBackFolder, func(gtx layout.Context) layout.Dimensions {
								lbl := material.Body1(th, "◀ Folders")
								lbl.Color = ColorPrimary
								return lbl.Layout(gtx)
							})
						}
						lbl := material.H6(th, "📁 Media Library")
						lbl.Color = ColorTextPrimary
						return lbl.Layout(gtx)
					}),
					layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
						if ex.currentFolder != "" {
							return layout.Inset{Left: unit.Dp(16)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
								lbl := material.Body1(th, ex.currentFolder)
								lbl.Color = ColorTextPrimary
								return lbl.Layout(gtx)
							})
						}
						return layout.Dimensions{}
					}),
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return material.Clickable(gtx, &ex.btnSort, func(gtx layout.Context) layout.Dimensions {
							lbl := material.Caption(th, fmt.Sprintf("Sort: %s", ex.sortOrder))
							lbl.Color = ColorPrimary
							return lbl.Layout(gtx)
						})
					}),
					layout.Rigid(func(gtx layout.Context) layout.Dimensions {
						return layout.Inset{Left: unit.Dp(16)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return material.Clickable(gtx, &ex.btnClose, func(gtx layout.Context) layout.Dimensions {
								lbl := material.Body1(th, "✕")
								lbl.Color = ColorTextSecondary
								return lbl.Layout(gtx)
							})
						})
					}),
				)
			})
		},
	)
}

func (ex *Explorer) layoutFolderList(gtx layout.Context, th *material.Theme) layout.Dimensions {
	var folderNames []string
	for name := range ex.folders {
		folderNames = append(folderNames, name)
	}

	if len(ex.folderClicks) < len(folderNames) {
		ex.folderClicks = make([]widget.Clickable, len(folderNames))
	}

	return material.List(th, &ex.folderList).Layout(gtx, len(folderNames), func(gtx layout.Context, index int) layout.Dimensions {
		name := folderNames[index]
		items := ex.folders[name]

		if ex.folderClicks[index].Clicked(gtx) {
			ex.currentFolder = name
		}

		return material.Clickable(gtx, &ex.folderClicks[index], func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{Top: unit.Dp(8), Bottom: unit.Dp(8), Left: unit.Dp(16), Right: unit.Dp(16)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				return layout.Background{}.Layout(gtx,
					func(gtx layout.Context) layout.Dimensions {
						defer clip.RRect{
							Rect: image.Rectangle{Max: gtx.Constraints.Min},
							NE:   8, NW: 8, SE: 8, SW: 8,
						}.Push(gtx.Ops).Pop()
						paint.Fill(gtx.Ops, ColorSurfaceLight)
						return layout.Dimensions{Size: gtx.Constraints.Min}
					},
					func(gtx layout.Context) layout.Dimensions {
						return layout.UniformInset(unit.Dp(16)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return layout.Flex{Axis: layout.Horizontal, Alignment: layout.Middle}.Layout(gtx,
								layout.Rigid(func(gtx layout.Context) layout.Dimensions {
									lbl := material.H5(th, "📁")
									return lbl.Layout(gtx)
								}),
								layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
									return layout.Inset{Left: unit.Dp(16)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
										return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
											layout.Rigid(func(gtx layout.Context) layout.Dimensions {
												lbl := material.Body1(th, name)
												lbl.Color = ColorTextPrimary
												return lbl.Layout(gtx)
											}),
											layout.Rigid(func(gtx layout.Context) layout.Dimensions {
												lbl := material.Caption(th, fmt.Sprintf("%d videos", len(items)))
												lbl.Color = ColorTextSecondary
												return lbl.Layout(gtx)
											}),
										)
									})
								}),
								layout.Rigid(func(gtx layout.Context) layout.Dimensions {
									lbl := material.Body2(th, "▶")
									lbl.Color = ColorPrimary
									return lbl.Layout(gtx)
								}),
							)
						})
					},
				)
			})
		})
	})
}

func (ex *Explorer) layoutVideoList(gtx layout.Context, th *material.Theme) layout.Dimensions {
	videos := ex.folders[ex.currentFolder]
	videos = storage.SortVideos(videos, ex.sortOrder)

	if len(ex.videoClicks) < len(videos) {
		ex.videoClicks = make([]widget.Clickable, len(videos))
	}

	return material.List(th, &ex.videoList).Layout(gtx, len(videos), func(gtx layout.Context, index int) layout.Dimensions {
		v := videos[index]

		if ex.videoClicks[index].Clicked(gtx) {
			if v.LastPosition > 10*time.Second {
				// Show resume dialog
				ex.resumePendingVideo = &v
			} else {
				if ex.OnSelectVideo != nil {
					ex.OnSelectVideo(v, 0)
				}
			}
		}

		return material.Clickable(gtx, &ex.videoClicks[index], func(gtx layout.Context) layout.Dimensions {
			return layout.Inset{Top: unit.Dp(6), Bottom: unit.Dp(6), Left: unit.Dp(16), Right: unit.Dp(16)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
				return layout.Background{}.Layout(gtx,
					func(gtx layout.Context) layout.Dimensions {
						defer clip.RRect{
							Rect: image.Rectangle{Max: gtx.Constraints.Min},
							NE:   8, NW: 8, SE: 8, SW: 8,
						}.Push(gtx.Ops).Pop()
						paint.Fill(gtx.Ops, ColorSurfaceLight)
						return layout.Dimensions{Size: gtx.Constraints.Min}
					},
					func(gtx layout.Context) layout.Dimensions {
						return layout.UniformInset(unit.Dp(12)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
							return layout.Flex{Axis: layout.Vertical}.Layout(gtx,
								layout.Rigid(func(gtx layout.Context) layout.Dimensions {
									return layout.Flex{Axis: layout.Horizontal, Alignment: layout.Middle}.Layout(gtx,
										layout.Flexed(1, func(gtx layout.Context) layout.Dimensions {
											lbl := material.Body1(th, v.Title)
											lbl.Color = ColorTextPrimary
											return lbl.Layout(gtx)
										}),
										layout.Rigid(func(gtx layout.Context) layout.Dimensions {
											durStr := formatDuration(v.Duration)
											lbl := material.Caption(th, durStr)
											lbl.Color = ColorPrimary
											return lbl.Layout(gtx)
										}),
									)
								}),
								// Watched progress line
								layout.Rigid(func(gtx layout.Context) layout.Dimensions {
									if v.LastPosition > 0 && v.Duration > 0 {
										pct := float32(v.LastPosition) / float32(v.Duration)
										return layout.Inset{Top: unit.Dp(6)}.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
											barWidth := int(float32(gtx.Constraints.Max.X) * pct)
											defer clip.Rect{Max: image.Point{X: barWidth, Y: 3}}.Push(gtx.Ops).Pop()
											paint.Fill(gtx.Ops, ColorPrimary)
											return layout.Dimensions{Size: image.Point{X: barWidth, Y: 3}}
										})
									}
									return layout.Dimensions{}
								}),
							)
						})
					},
				)
			})
		})
	})
}

func (ex *Explorer) layoutResumeDialog(gtx layout.Context, th *material.Theme) layout.Dimensions {
	return layout.Center.Layout(gtx, func(gtx layout.Context) layout.Dimensions {
		return layout.Background{}.Layout(gtx,
			func(gtx layout.Context) layout.Dimensions {
				defer clip.RRect{
					Rect: image.Rectangle{Max: gtx.Constraints.Min},
					NE:   12, NW: 12, SE: 12, SW: 12,
				}.Push(gtx.Ops).Pop()
				paint.Fill(gtx.Ops, ColorSurface)
				return layout.Dimensions{Size: gtx.Constraints.Min}
			},
			func(gtx layout.Context) layout.Dimensions {
				return layout.UniformInset(unit.Dp(24)).Layout(gtx, func(gtx layout.Context) layout.Dimensions {
					timeStr := formatDuration(ex.resumePendingVideo.LastPosition)
					return layout.Flex{Axis: layout.Vertical, Alignment: layout.Middle}.Layout(gtx,
						layout.Rigid(func(gtx layout.Context) layout.Dimensions {
							lbl := material.H6(th, fmt.Sprintf("Resume from %s?", timeStr))
							lbl.Color = ColorTextPrimary
							return lbl.Layout(gtx)
						}),
						layout.Rigid(layout.Spacer{Height: unit.Dp(16)}.Layout),
						layout.Rigid(func(gtx layout.Context) layout.Dimensions {
							return layout.Flex{Axis: layout.Horizontal}.Layout(gtx,
								layout.Rigid(func(gtx layout.Context) layout.Dimensions {
									return material.Button(th, &ex.btnResume, "Resume").Layout(gtx)
								}),
								layout.Rigid(layout.Spacer{Width: unit.Dp(16)}.Layout),
								layout.Rigid(func(gtx layout.Context) layout.Dimensions {
									btn := material.Button(th, &ex.btnStartOver, "Start Over")
									btn.Background = ColorSurfaceLight
									return btn.Layout(gtx)
								}),
							)
						}),
					)
				})
			},
		)
	})
}
