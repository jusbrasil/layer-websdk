/* eslint-disable */
describe("The Content class", function() {
    var appId = "Fred's App";
    var userId = "Frodo";
    var conversation,
        client,
        requests;

    afterAll(function() {
        layer.Client.destroyAllClients();
    });

    beforeEach(function() {
        jasmine.Ajax.install();
        requests = jasmine.Ajax.requests;
        client = new layer.Client({
            appId: appId,
            reset: true,
            url: "https://doh.com"
        });
        client.user = {userId: userId};

        client._clientAuthenticated();
        getObjectsResult = [];
        spyOn(client.dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
            setTimeout(function() {
                callback(getObjectsResult);
            }, 10);
        });
        client._clientReady();
        client.onlineManager.isOnline = true;

        conversation = layer.Conversation._createFromServer(responses.conversation2, client).conversation;
        requests.reset();
        client.syncManager.queue = [];
    });
    afterEach(function() {
        client.destroy();
        jasmine.Ajax.uninstall();
    });


    describe("The constructor() method", function() {
        it("Should initialize with an object", function() {
            expect(new layer.Content({downloadUrl: "hey"}).downloadUrl).toEqual("hey");
            expect(new layer.Content({expiration: 100000}).expiration).toEqual(100000);
            expect(new layer.Content({refreshUrl: "hey"}).refreshUrl).toEqual("hey");
            expect(new layer.Content({id: "content"}).id).toEqual("content");
        });

        it("Should initialize by id", function() {
            expect(new layer.Content("content").id).toEqual("content");
        });
    });

    describe("The loadContent() method", function() {
        it("Should send a request to the server", function() {
            var content = new layer.Content({
                downloadUrl: "http://hey.com"
            });

            // Run
            content.loadContent("text/plain");

            // Posttest
            expect(requests.mostRecent().url).toEqual("http://hey.com");
            expect(requests.mostRecent().method).toEqual("GET");
            expect(requests.mostRecent().responseType).toEqual("arraybuffer");
        });

        it("Should call the callback", function() {

            var content = new layer.Content({
                downloadUrl: "http://hey.com"
            });
            var spy = jasmine.createSpy('spy');

            // Run
            content.loadContent("text/plain", spy);

            requests.mostRecent().response({
                status: 200,
                responseText: atob("abc938a")
            });

            // Posttest
            expect(spy).toHaveBeenCalledWith(null, jasmine.any(Blob));
        });

        it("Should call the callback if Blob is undefined", function() {
            var tmp = window.Blob;
            window.Blob = undefined;

            var content = new layer.Content({
                downloadUrl: "http://hey.com"
            });
            var spy = jasmine.createSpy('spy');

            // Run
            content.loadContent("text/plain", spy);

            requests.mostRecent().response({
                status: 200,
                responseText: "abc938a"
            });

            // Posttest
            expect(spy).toHaveBeenCalledWith(null, "abc938a");

            // Cleanup
            window.Blob = tmp;
        });

        it("Should call the callback with an error", function() {
            var tmp = window.Blob;
            window.Blob = undefined;

            var content = new layer.Content({
                downloadUrl: "http://hey.com"
            });
            var spy = jasmine.createSpy('spy');

            // Run
            content.loadContent("text/plain", spy);

            requests.mostRecent().response({
                status: 404,
                responseText: "abc938a"
            });

            // Posttest
            expect(spy).toHaveBeenCalledWith("abc938a", null);

            // Cleanup
            window.Blob = tmp;
        });
    });

    describe("The refreshContent() method", function() {
      var content;
      beforeEach(function() {
        content = new layer.Content({
            downloadUrl: "http://hey.com",
            refreshUrl: "https://ho.com",
            expiration: 100000,
            contentId: "fred"
        });
      })

      it("Should call xhr", function() {
          content.refreshContent(client);
          expect(requests.mostRecent().url).toEqual("https://ho.com");
          expect(requests.mostRecent().method).toEqual("GET");
      });

      it("Should set expiration and downloadUrl", function() {
        content.refreshContent(client);
        requests.mostRecent().response({
          status: 200,
          responseText: JSON.stringify({
            expiration: 300000,
            download_url: "http://there.com"
          })
        });
        expect(content.downloadUrl).toEqual("http://there.com");
        expect(content.expiration.getTime()).toEqual(300000);
      });

      it("Should call the callback", function() {
        var spy = jasmine.createSpy('callback');
        content.refreshContent(client, spy);
        requests.mostRecent().response({
          status: 200,
          responseText: JSON.stringify({
            expiration: 300000,
            download_url: "http://there.com"
          })
        });
        expect(spy).toHaveBeenCalledWith("http://there.com");
      });
    });

    xdescribe("The isExpired() method", function() {});

    describe("The static _createFromServer() method", function() {
        it("Should initialize with an object", function() {
            expect(layer.Content._createFromServer({download_url: "hey1"}).downloadUrl).toEqual("hey1");
            expect(layer.Content._createFromServer({expiration: 100000}).expiration).toEqual(new Date(100000));
            expect(layer.Content._createFromServer({refresh_url: "hey2"}).refreshUrl).toEqual("hey2");
            expect(layer.Content._createFromServer({id: "content"}).id).toEqual("content");
        });
    });
});
