package shader

import (
	_ "embed"
)

//go:embed sbs.vert
var SBSVertShader string

//go:embed sbs.frag
var SBSFragShader string
