OA.Clipper = function(userSetting) {
    Array.call(this);
    //private
    var _def = {
        baseFaces: [],
        faces: [],
        angle: 0,
        cardH: 0,
        cardW: 0
    };
    var _setting = $.extend({}, _def, userSetting);
    var clipper = this;
    var baseFaces = OA.Utils.facesClone(_setting.baseFaces);
    var faces = _setting.faces;
    var angle = _setting.angle;
    var sort_vface_list = [];
    var upper_list = [];
    var cardW = _setting.cardW, cardH = _setting.cardH;
    var clipScale = 100;
    var totalCardArea = [{X:0,Y:-cardH}, {X:cardW,Y:-cardH}, {X:cardW,Y:cardH}, {X:0,Y:cardH}  ];
     //OA clip Algorithm
     //### Create hface_list ###
     //1. create sort_vface_list (sort by t big->small) 
     //  1.1 clip vface whick out of card boundary
     //2. create upper_list (sort by 2D z)
     //2. for each uppper in upper_list
     //3. create HFACE
     //  3.1 create baseHFace from upper
     //  3.2 for any vface in sort_vface_list
     //  3.3 create tmpHFace from upper to vface
     //  3.4 create tempvface (tempHFace sub vface)
     //  3.5 baseHFace = baseHFace - tempvface
     //  3.6 if baseHFace is become 2 pieces 
     //      3.6.1 baseHFace  = the piece which connect with upper
     //      3.6.2 if baseHFace is null, break for loop; and else, continue to check next vface
     //4. store baseHFACE to hface_list

     //###Add to model###
     //1. add each vface in reverse sort_vface_list to model ()
     //2. add each hface in hface_list to model
     

   function compareFaceT(faceA, faceB) {
     //big -> small
     return faceB.getT() - faceA.getT();
   }

   function compareUpperY(upper1, upper2) {
     //big -> small
     return upper1.points[0].Y - upper2.points[0].Y;
   }

    // console.error("==sort_vface_list=======")
    // $.each(sort_vface_list, function(i, t) {
    //     console.error("t: " + t.getT());
    // });

    // console.error("==sort_vface_list reverse=======")
    // sort_vface_list.reverse(compareT);
    // $.each(sort_vface_list, function(i, t) {
    //     console.error("t: " + t.getT());
    // });

    function polyBoolean(subjPoly, clipPoly, clipType) {
        var success = null;
        try {
          
            //Number ClipType {ctIntersection: 0, ctUnion: 1, ctDifference: 2, ctXor: 3};
            var subj_paths = ClipperLib.JS.ExPolygonsToPaths(subjPoly);
            var clip_paths = ClipperLib.JS.ExPolygonsToPaths(clipPoly);
            var solution_paths = new ClipperLib.PolyTree();
            subj_paths = ClipperLib.JS.Clone(subj_paths);
            clip_paths = ClipperLib.JS.Clone(clip_paths);
            ClipperLib.JS.ScaleUpPaths(subj_paths, clipScale);
            ClipperLib.JS.ScaleUpPaths(clip_paths, clipScale);

            var cpr = new ClipperLib.Clipper();
            cpr.StrictlySimple = true;
            cpr.AddPaths(subj_paths, 0, true); // true means closed path
            cpr.AddPaths(clip_paths, 1, true);
            success = cpr.Execute(clipType, solution_paths, 1, 1);
        } catch (e) {
            debugger;
            console.error("clip failed !");

        }

        //ClipperLib.JS.ScaleDownPaths(subj_paths, clipScale);
        //ClipperLib.JS.ScaleDownPaths(clip_paths, clipScale);

        if (success) {
            var expolygons = ClipperLib.JS.PolyTreeToExPolygons(solution_paths);
            if(OA.tunePath){
                 OA.Utils.exPolygonsClean(expolygons, 0.1);
            }
            OA.Utils.scaleDownExPolygon(expolygons, clipScale);
            return expolygons;
        } else {
            return null;
        }

    }

    function clipBoundary(faceAry) {
        $.each(faceAry, function(i, f) {
            var faceSetting = f.oaInfo;
            if (f.oaInfo.isBoundaryClipped) {
                //sort_vface_list.push(f.clone());
                return true;
            }
            var t = f.getT();
            var subj = f.getExPolygons();
            var path=[{X:0,Y:t},{X:cardW,Y:t},{X:cardW,Y:cardH},{X:0,Y:cardH}];
            var clip = OA.Utils.simplePathToPoly(path);
            var resPoly = polyBoolean(subj, clip, 2);
            if (resPoly) {
                clip = OA.Utils.simplePathToPoly(totalCardArea);
                resPoly = polyBoolean(resPoly, clip, 0);
                if (resPoly) {
                    f.rebuild(resPoly);
                    f.oaInfo.isBoundaryClipped = true;
                }
            }
        });
    }

    var init = function(){

        clipBoundary(faces);
        //step 1
        //sort_vface_list = faces.slice(0); //not deep copy
        sort_vface_list = OA.Utils.facesClone(faces);
        sort_vface_list.sort(compareFaceT);

        //step 2
        $.each(sort_vface_list, function(i, f){
            var upper2Ds = f.getUpper2Ds();
            if(upper2Ds){
                $.each(upper2Ds, function(j, upper){
                    upper_list.push({points: upper, t: f.getT()});
                });
            }
        });
        upper_list.sort(compareUpperY);


        //test
        sort_vface_list.reverse(); //small -> big

        var fff = sort_vface_list[0]
        var unionPolys = fff.getExPolygons();

        for (var j = 1; j < sort_vface_list.length; j++) {
            var clip = sort_vface_list[j].getExPolygons();
            unionRes = polyBoolean(unionPolys, clip, 1);
            if (unionRes) {
                //console.error("union")
                unionPolys = unionRes;
            }
        }

        $.each(baseFaces, function(i, f) {
            var subj = f.getExPolygons();
            var clip = unionPolys;
            var resPoly = polyBoolean(subj, clip, 2);
            if (resPoly) {
                subj = resPoly;
            } else {
                console.error("failed !");
            }

            f.rebuild(subj);
        });

        $.each(sort_vface_list, function(i, f) {
            var subj = f.getExPolygons();
            for (var j = i + 1; j < sort_vface_list.length; j++) {
                var ff = sort_vface_list[j];
                var clip = ff.getExPolygons();
                var resPoly = polyBoolean(subj, clip, 2);
                if (resPoly) {
                    subj = resPoly;
                }
            }
            f.rebuild(subj);

        });


        return clipper;
    };

    this.doClip = function(){
        if(0){
            //return original input faces
            for(var i=0; i< baseFaces.length; i++){
                baseFaces[i].setAngle(angle);
                clipper.push(baseFaces[i]);
            }

            for(var i=0; i< faces.length; i++){
                faces[i].setAngle(angle);
                clipper.push(faces[i]);
            }
        }else{
            //return clipped faces
            for (var i = 0; i < baseFaces.length; i++) {
                baseFaces[i].setAngle(angle);
                clipper.push(baseFaces[i]);
            }

            for (var i = 0; i < sort_vface_list.length; i++) {
                sort_vface_list[i].setAngle(angle);
                clipper.push(sort_vface_list[i]);
            }
        }

        return true;
    };
    return init();
};

OA.Clipper.prototype = Object.create(Array.prototype);