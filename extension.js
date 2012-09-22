// Copyright (C) 2011-2012 Stephen Warren
// Licence: GPLv2+
//
// Based on Panel Favorites Copyright (C) 2011-2012 R M Yorston
// Based on QuickLaunch@github.com

const FileUtils = imports.misc.fileUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const St = imports.gi.St;

// FIXME: Allow this to be configured in gconf?
const qlPath = GLib.get_home_dir() + '/.local/user/quicklaunch';

function QLButton(app) {
    this._init(app);
}

QLButton.prototype = {
    _init: function(appinfo) {
        this.appinfo = appinfo;

        this.actor = new St.Button({ style_class: 'qlitem',
                                     reactive: true });
        this.actor._delegate = this;

        this.actor.set_child(new St.Icon({
            gicon: appinfo.get_icon(),
            // FIXME: Get size from some config value?
            icon_size: 24,
            style_class: 'qlicon'
        }));
        //this.actor.set_tooltip_text(appinfo.get_name());

        this.actor.connect('clicked', Lang.bind(this, function() {
            this.appinfo.launch([], null);
        }));

        this.actor.connect('notify::hover',
                Lang.bind(this, this._onHoverChanged));
        this.actor.opacity = 207;
    },

    _onHoverChanged: function(actor) {
        actor.opacity = actor.hover ? 255 : 207;
    },
};

function QLContainer() {
    this._init();
}

QLContainer.prototype = {
    _init: function() {
    },

    addItem: function(filename) {
        this.removeItem(filename);

        if (filename.indexOf('.desktop') < 0)
            return;

        let pathname = qlPath + '/' + filename;
        let fileObj = Gio.file_new_for_path(pathname);
        type = fileObj.query_file_type(Gio.FileQueryInfoFlags.NONE, null);
        if (type != 1)
            return;

        let appinfo = new Gio.DesktopAppInfo.new_from_filename(pathname);
        if (!appinfo)
            return null;

        let item = new QLButton(appinfo);
        this.items[filename] = item;

        let itemkeys = [];
        for (let i in this.items)
            itemkeys.push(i);
        itemkeys.sort();
        let index = itemkeys.indexOf(filename);
        this.actor.insert_child_at_index(item.actor, index);
    },

    removeItem: function(filename) {
        if (!(filename in this.items))
            return;

        let item = this.items[filename];
        item.actor.destroy();
        delete this.items[filename];
    },

    enable: function() {
        this.items = new Object();

        this.actor = new St.BoxLayout({ name: 'qlContainer',
                                        style_class: 'qlcontainer' });

        let qlPathObj = Gio.file_new_for_path(qlPath);

        this.qlPathMon = qlPathObj.monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this.qlPathMonSigId = this.qlPathMon.connect('changed',
            Lang.bind(this, function (monitor, f, otherf, event) {
                if (event == 1)
                    this.addItem(f.get_basename())
                else if (event == 2)
                    this.removeItem(f.get_basename())
                else if (event == 3)
                    this.addItem(f.get_basename())
        }));

        FileUtils.listDirAsync(qlPathObj, Lang.bind(this, function(files) {
            for (let i = 0; i < files.length; i++)
                this.addItem(files[i].get_name())
        }));

        Main.panel._leftBox.insert_child_at_index(this.actor, 3);
    },

    disable: function() {
        Main.panel._leftBox.remove_actor(this.actor);

        this.qlPathMon.disconnect(this.qlPathMonSigId);
        delete this.qlPathMonSigId;
        delete this.qlPathMon;

        for (let i in this.items) {
                this.removeItem(i);
        }

        delete this.actor;
        delete this.items;
    }
};

function init() {
    return new QLContainer();
}
